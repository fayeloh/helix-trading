# 交给 KIMI 的「标的研究」模块对齐提示词

用法：把下面代码块里的**全部内容**复制，粘贴给 KIMI（或任意 AI Builder），让它按此规格重做「标的研究」模块。规格包含页面结构、四个 Tab 的完整 JSON Schema、取数与 AI 的分工、展示规则与验收清单。字段名与枚举必须原样使用，不得改名。

---

```
# 任务：把「标的研究」模块改造成与 Helix Trading 完全一致

你是资深全栈工程师。请把当前项目里的「标的研究 / Research」模块**整体重做**，严格对齐下面的规格。字段名、枚举值、计算公式、展示顺序都必须原样实现，不得自行改名、增删字段或改变含义。这是一个交易「决策辅助」工具：不下单、不代客理财、不输出买卖建议、不构成投资建议。

## 0. 最高原则（与你现有实现最大的差异，务必先读）

1. **代码算硬数据，AI 只写解读。** 所有可核对的数字（营收、净利、EPS、一致预期、财报后涨跌幅、月度季节性、内部人/机构/链上申报记录）必须由服务端代码从公开数据源取到或算出，再作为 grounding 注入 prompt，并要求模型「原样采用，禁止改数」。模型只负责文字解读、归因、观察要点。
2. **禁止编造。** 任何无法确认的数值字段返回 `null`，无法确认的列表返回空数组，并把缺口写进 `data_gaps` / `caveats`。宁可显示「未披露 / 无一致预期 / 数据不可用」，也不允许用推测值填充。
3. **每一条内容都要可溯源。** 每个条目带 `kind: "fact" | "inference"`；`fact` 必须给 `source` 与 `as_of`，`inference` 必须给 `confidence`。
4. **代码无法验证就不生成报告。** 见第 2 节。
5. 禁止输出目标价、评级、荐股结论；只输出「观察要点」「触发条件」「风险点」。

## 1. 页面结构

路由：`/research`，页面标题「标的深度研究」。

顶部输入区（一张卡片，横排）：
- 标的代码输入框，带搜索联想（输入 `TSLA`、`腾讯`、`700` 都能给出候选；联想失败时仍允许直接提交完整代码，并提示「未取得联想结果，将直接按输入代码验证」）。
- 市场下拉：`US` 美股 / `HK` 港股 / `CN` A股 / `CRYPTO` 加密 / `OTHER` 其他。
- 资金流时间窗下拉：`30 / 90 / 180 / 365` 天（默认 90）。
- 「生成研究」按钮 + 「强制刷新」选项。

下方为四个 Tab（顺序固定）：
| key | 标签 |
| --- | --- |
| `fundamentals` | 公司基本面 |
| `earnings` | 财报分析 |
| `cycle` | 周期与季节性 |
| `flows` | 资金流向 |

每个 Tab 独立生成、独立缓存。空态显示「尚未生成，点击上方按钮生成本模块」；错误态显示具体错误文案，不整页崩溃。

## 2. 代码解析与验证（生成前置步骤，必须实现）

在调用 AI 之前，先用 `resolveSymbol(input, market)` 解析并验证标的，返回：
`{ symbol, name, exchange, market, instrumentType, verified, source }`

解析层级（依次尝试，任一命中即可标记 `verified: true`）：
1. 行情接口的 chart metadata（`shortName` / `longName` / `exchange` / `instrumentType`）。
2. 官方 ticker 目录（如监管机构公布的 company_tickers 全量表，本地缓存 7 天）。
3. 行情搜索接口。
4. 本地别名表（中文名 / 常见简称）。

归一化规则：
- 港股：`700` / `0700` → `0700.HK`（补零到 4 位 + `.HK`）
- A 股：`600519` → `600519.SS`；`000001` → `000001.SZ`（6 开头沪市，0/3 开头深市）
- 加密：`BTC` → `BTC-USD`
- 已带后缀的输入原样保留。
- 纯数字代码在 UI 上必须显示为「代码 + 公司名」。

**若 `verified === false`：直接抛错并在 UI 显示「暂时无法从公开行情或监管资料确认代码 {symbol}。请检查代码与市场，或稍后重试。」——绝对不允许调用 AI 生成猜测报告。**

## 3. 缓存

研究结果存表 `research_reports`，缓存键为 `symbol + market + section + lookback_days + lang`，`expires_at = now + 24h`。`force = true` 时跳过缓存重新生成。
额外规则：`fundamentals` 的旧缓存若 `payload.company_profile.legal_name` 为空，**不得命中缓存**，必须重新生成。
外部数据另设 `market_cache`（仅服务端可读）：公司档案 7 天、财报数字 12 小时、季节性 24 小时、事件时间轴 15 分钟、低信息档案结果 30 分钟。

## 4. 注入 AI 的真实数据（grounding）

### 4.1 fundamentals
调用 `getCompanyProfile(ysym)`：合并第三方财务档案接口 + 监管目录 + 行情 metadata，得到
`{ name, exchange, sector, industry, founded, headquarters, employees, marketCap, website, source, as_of }`。
- 注入文案：「已验证标的身份：{resolved}；真实公司档案（来源 X，as_of Y，必须原样采用）：{profile}」。
- 取不到时注入：「未取得第三方公司档案数据：`company_profile` 各字段只能填你能确认的内容，其余返回 null，kind 设为 inference。」
- **AI 返回后，代码必须覆写** `company_profile` 的这些字段为真实档案值：`legal_name`、`exchange_ticker`（格式 `{exchange} / {ysym}`）、`sector`、`industry`、`founded`、`headquarters`、`employees`、`market_cap`、`website`、`source`、`as_of`，并把 `kind` 固定为 `"fact"`。只有 `summary` 由 AI 撰写。

### 4.2 earnings
- `getEarningsFacts(ysym, 3)`：近 3 次财报，EPS 实际与一致预期取自公开财报预期接口，营收与净利润取自监管 XBRL 申报。含 `report_date` 与 `timing`（`before_open` / `after_close` / `unknown`）。
- `getEarningsReactions(ysym, dates)`：用日线在代码里算财报后反应。基准规则：**盘后发布 → 基准为发布日收盘，对比次日收盘；盘前发布 → 基准为前一交易日收盘。** 输出次日 / 3 日 / 5 日涨跌幅（两位小数）与所用 `base_date`；缺 K 线返回 `null`。
- `getUsEarningsForecast(symbol)`：下一次财报的前瞻一致预期（一致 EPS、分析师家数、区间高低、一致营收、预计发布日与盘前/盘后）。
- 注入文案强调：「必须原样采用并据此计算差异；null 表示无公开数据」「禁止改数」「无法确认的字段返回 null，并在 caveats 说明『无一致预期数据』」「expected_date 为 null 时把 date_confidence 设为 low」。

### 4.3 cycle
- `getSeasonality(ysym)`：近 10 年月线聚合，输出每月 `avg_return_pct`、`win_rate_pct`，以及 `complete_years`（完整年度数）、年度最高价出现月份次数、年度最低价出现月份次数、最好/最差单月。
- `getEventsWindow({ symbol, ysym, lang })`：合并「本标的财报日 + 标的相关新闻（含 pubDate 与原文链接）+ 宏观日程」为统一时间轴，每条含 `at`、`title`、`source`、`url`、时间粒度标记。取前 20 条注入。
- 注入文案：「monthly_stats 必须原样采用其 avg_return_pct 与 win_rate_pct，禁止改数」「upcoming_events 只能从给定事件中挑选，date 用其 `at` 字段」；取不到时对应字段必须返回空数组。

### 4.4 flows
- `getFlowFacts({ symbol, ysym, market })`：内部人交易（Form 4）、机构持仓变动（13F 汇总）、链上鲸鱼转账（公链浏览器）。
- 注入文案：「必须原样采用，kind 设为 fact，并把 source、source_url、filed_at 原样带出」；无记录时「records 必须返回空数组，禁止编造任何主体、数量或金额」；已知缺口原样写入 `data_gaps`（港股与加密的公开披露有限，必须说明）。

另外所有模块都注入一句实时行情参考：
`最新价 {price} {currency}，近一年涨跌 {pct}%（来源 Yahoo Finance，抓取时间 {ISO}）`；取不到写「行情数据不可用」。

## 5. AI 调用与全局护栏

结构化输出：`response_format = json_schema`，`strict: true`，深度模型（如 Gemini 3.1 Pro 级别）。system prompt = 全局护栏 + 模块专属指令。

全局护栏（原文照抄，`lang` 决定第 1 条）：
1. 全部输出使用简体中文；公司名、代码、财务术语可保留英文。（英文模式：Write ALL output in English (US). Keep tickers and financial terms in English.）
2. 严格区分「事实」与「推演」：`kind` 必须为 `"fact"`（有公开数据支撑，需给出 source 与 as_of）或 `"inference"`（你的推理，需给出 confidence）。
3. 不确定或没有可靠数据时，必须写 `"unknown"` 或将该项留空，绝对禁止编造具体数字、日期、金额或引用不存在的报道。
4. 不得输出任何买卖建议、目标价、评级或荐股结论。只输出「观察要点」「触发条件」「风险点」。
5. 数字类字段若无可靠依据，返回 `null`。
6. 你的训练数据存在截止时间，涉及近期数据时必须在 `caveats` 中说明数据可能过时。

通用条目结构 `SOURCED`（用于 moat / customers / suppliers / competition / differentiation / weaknesses / key_metrics）：
required: `["text","kind","source","as_of","confidence"]`
- `text`: string
- `kind`: enum `["fact","inference"]`
- `source`: string | null
- `as_of`: string | null
- `confidence`: enum `["high","medium","low",null]`

## 6. 四个 JSON Schema（逐字段实现，全部字段均为 required，`additionalProperties: false`）

### 6.1 FUNDAMENTALS_SCHEMA
required: `company_profile, overview, business_lines, product_lines, regions, business_model, moat, customers, suppliers, competition, peer_comparison, differentiation, weaknesses, caveats`

- `company_profile` (object) required: `legal_name, exchange_ticker, sector, industry, founded, headquarters, employees, market_cap, website, summary, kind, source, as_of`
  - `employees`: number | null；其余身份字段 string | null；`summary`: string（3–5 句业务概述）；`kind`: enum fact/inference。
- `overview`: string（业务概览段落）
- `business_lines` / `product_lines` (array of object) required: `name, revenue_share_pct, note, kind, source, as_of`
  - `revenue_share_pct`: number | null，保留 1 位小数，同一组合计应尽量接近 100
- `regions` (array of object) required: `name, revenue_share_pct, kind, source, as_of`
- `business_model`: string
- `moat` / `customers` / `suppliers` / `competition`: array of `SOURCED`
- `peer_comparison` (array，3–5 家真实可比公司) required: `peer, ticker, metrics, note, kind, source, as_of`
  - `metrics` (array of object) required: `metric, target_value, peer_value, edge`
    - `metric`: 如 毛利率 / 营收增速 / 市占率 / 估值
    - `edge`: enum `["target_better","peer_better","similar","unknown"]`
- `differentiation`: array of `SOURCED`（差异化优势；确实没有则返回空数组，并在 caveats 写「未发现明显差异化」）
- `weaknesses`: array of `SOURCED`（相对同行的劣势）
- `caveats`: string

模块指令：company_profile 必须给出公司全称、交易所与代码、板块行业、成立年份、总部、员工数、市值、官网与 3–5 句业务概述；若输入中已提供真实档案数据，必须原样采用，不得改写。必须按业务线与产品线分别给出营收占比，并给出地区收入拆分；任何占比数字都必须来自公开财报，无法确认则 `revenue_share_pct` 返回 null 并在 note 中说明原因。

### 6.2 EARNINGS_SCHEMA
required: `recent_reports, next_report, key_metrics, caveats`

- `recent_reports` (array，近 3 次) required: `period, report_date, report_timing, currency, revenue_actual, revenue_estimate, revenue_surprise_abs, revenue_surprise_pct, net_income_actual, net_income_estimate, eps_actual, eps_estimate, eps_surprise_abs, eps_surprise_pct, summary, beat_or_miss, next_day_move_pct, five_day_move_pct, kind, source`
  - `report_timing`: enum `["before_open","after_close","unknown"]`
  - 金额字段为带单位字符串（如 `94.93B USD`）或 null；`*_surprise_pct`、`*_move_pct` 为 number | null
  - `beat_or_miss`: enum `["beat","miss","mixed","unknown"]`
- `next_report` (object) required: `expected_date, date_confidence, consensus_eps, consensus_revenue, watch_items, skew, skew_reasoning`
  - `date_confidence`: enum `["high","medium","low",null]`
  - `skew`: enum `["bullish","bearish","neutral","unknown"]`，只表示市场预期偏向，不是投资建议
- `key_metrics`: array of `SOURCED`
- `caveats`: string

差异统一公式：`(实际 - 预期) / |预期| × 100`，超预期为正，保留两位小数。缺失显示 `—`。

### 6.3 CYCLE_SCHEMA
required: `sector, economic_cycle_stage, industry_cycle_stage, stage_reasoning, strong_months, weak_months, monthly_stats, upcoming_events, caveats`
- `economic_cycle_stage`: enum `["early_expansion","mid_expansion","late_expansion","slowdown","recession","recovery","unknown"]`
- `industry_cycle_stage`: string；`stage_reasoning`: string
- `strong_months` / `weak_months`: array of string（旺季 / 淡季月份）
- `monthly_stats` (array) required: `month, avg_return_pct, win_rate_pct, kind, source`
- `upcoming_events` (array，前后一个月) required: `date, event, direction, logic, confidence`
  - `direction`: enum `["bullish","bearish","neutral","unknown"]`
- `caveats`: string

### 6.4 FLOWS_SCHEMA
required: `window_days, summary, records, data_gaps, caveats`
- `window_days`: number
- `summary`: string
- `records` (array) required: `entity, entity_type, side, date, shares_or_amount, price, total_value, kind, source, source_url, filed_at, note, confidence`
  - `entity_type`: enum `["institution_13f","insider_form4","whale_onchain","fund_flow","unknown"]`
  - `side`: enum `["buy","sell","unknown"]`
- `data_gaps`: array of string
- `caveats`: string

返回 payload 时，把代码算出的硬数据一并挂在 `_facts` 字段下（`forecast`、`reactions`、`seasonality`、`events`），UI **优先展示 `_facts`**，AI 文本只作为解读补充。

## 7. UI 展示规则（顺序固定）

### 7.1 公司基本面
1. **公司简介卡**：定义列表（公司全称 / 交易所与代码 / 板块 / 行业 / 成立年份 / 总部 / 员工数 / 市值 / 官网），下方 3–5 句概述，卡片脚注显示「来源 X · 数据时间 Y」。
2. **业务概览卡**：`overview` 段落。
3. **营收占比三卡**：按业务线、按产品线（并排两列）、按地区（整行）。每项显示名称 + `42.3%` 数值 + 水平占比条 + note；每组显示合计值；无法确认显示「未披露」而不是空白。
4. **同业竞争力对比卡**：每家可比公司一个区块，指标表三列（本标的 / 同行 / edge 徽章：占优=绿、落后=红、相当=灰）；下方两栏列出「差异化优势」与「相对劣势」。
5. **四张要点卡**：护城河 / 主要客户 / 主要供应商 / 竞争格局，每条显示文本 + fact/inference 徽章 + 来源与时间。

### 7.2 财报分析
- 每期财报一张卡：
  - 卡头：`period` + 精确发布日期 + 盘前/盘后标签 + `beat_or_miss` 徽章。
  - 表格：三行（营收 / 净利润 / EPS）× 四列（实际 / 机构预期 / 差额 / 差异%）；正值绿 `#2A9D8F`、负值红 `#E63946`；缺失显示 `—`。
  - 财报后波动行：次日 / 3 日 / 5 日涨跌幅（两位小数）+ 所用基准收盘日，便于核对。
  - 卡脚：来源。
- **下一次财报卡**：预计日期 + 盘前/盘后 + `date_confidence`；一致 EPS（含分析师家数与区间高低）；一致营收；观察要点清单；`skew` 与理由（措辞必须是「市场预期偏向」，不是建议）。取不到一致预期时显示「无公开一致预期」。

### 7.3 周期与季节性
1. **周期定位卡**：所属板块、经济周期阶段、行业周期阶段、判断理由、旺季/淡季月份。
2. **季节性卡**：12 个月热力条（绿深=强、红深=弱）+ 紧凑表格列出：月均涨跌幅、上涨月占比（胜率）、年度最高价出现次数、年度最低价出现次数、最好/最差单月；单独高亮「最常出现年度高点的月份」与「年度低点的月份」；标注样本年数（如「基于近 9 个完整年度」），不足 5 年显示样本不足提示。
3. **事件时间轴卡**：按时间排序，过去/未来用分隔线区分；每条显示日期 + 具体时间（按用户所选时区显示，悬浮提示美东原始时间）+ 标题 + 来源 + 「查看原文」外链；只有日期没有时刻的标注「仅日期」，不伪造时刻。

### 7.4 资金流向
1. **摘要卡**：显示窗口天数，并附一句窗口用意说明（30 天=近期动向、90 天=季度申报周期、180/365 天=中长期趋势）。
2. **记录卡**：每条显示主体名称、类型徽章（机构 13F / 内部人 Form 4 / 链上鲸鱼 / 资金流）、买卖方向着色、日期、数量或金额、价格、总额、备注、申报时间，以及「查看申报」外链。
3. **数据缺口区块**：逐条列出 `data_gaps`（如「港股无 Form 4 等同披露」）。

### 7.5 视觉与格式
赛博朋克：黑底 + 荧光浅绿 `#39FF88` 作为强调色 + 浅灰层级；上涨 `#2A9D8F`、下跌 `#E63946`；标题 Space Grotesk，数字用等宽 tabular 字体；百分比统一两位小数；圆角 4px；图标用线性 SVG（Lucide 风格）。所有颜色必须走语义 token（CSS 变量），**禁止在组件里硬编码颜色，禁止紫色/靛蓝渐变**。

## 8. 双语与合规

- `lang: "zh" | "en"` 同时作用于界面文案与 AI 输出；缓存键包含语言，两种语言各自缓存互不覆盖；日期与数字按 `zh-CN` / `en-US` 本地化。
- 每份 AI 报告顶部与页面底部显示免责声明：内容由 AI 生成，仅供研究参考，不构成投资建议，本工具不执行任何交易下单。

## 9. 错误处理与降级

- 单个数据源失败（429 / 5xx / 401）只降级该字段为「数据不可用」，不整页报错；401 要在服务端日志显式记录（说明是密钥问题而不是无数据）。
- 行情 429 时使用过期缓存（冷缓存）并标注抓取时间。
- 密钥只存服务端环境变量，绝不出现在前端代码或响应里。

## 10. 验收清单（逐项跑通）

1. `AAPL`：公司档案字段齐全且来源标注为真实档案源；三组营收占比均带 `%` 且有合计；同业对比 3–5 家 + 差异化/劣势清单。
2. `TSLA`：近 3 期财报显示日期 + 盘前盘后 + 营收/净利/EPS 的实际与预期及差额与百分比；财报后 1/3/5 日波动带基准日；下一次财报显示一致 EPS 与分析师家数。
3. `CRWV`（新上市股）：能被验证并生成档案，不出现「无法确认公司全称」。
4. `0700.HK`（输入 `700` 也要能解析）：缺一致预期的字段显示「未披露 / 无一致预期」，`data_gaps` 有说明，无虚构数字。
5. `BTC-USD`：flows 显示链上鲸鱼记录与缺口说明。
6. 季节性卡显示 12 月热力条 + 胜率 + 年度高低点月份 + 样本年数；事件时间轴每条可点开原文。
7. 输入无效代码（如 `ZZZZZZ`）：明确报错，且**没有**生成任何 AI 报告。
8. 切换到 English：界面与新生成的报告均为英文，切回中文仍可读到中文缓存。
```
