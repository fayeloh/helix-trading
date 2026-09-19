# Helix Trading — API & Data Source Handoff / 接口与密钥交接文档

> 交接对象：KIMI / Base44 / 任意 AI Builder。
> 本文件可整份复制粘贴。**不含任何密钥明文** —— 所有 key 均加密存储在平台密钥库中，无法导出，接手方需自行申请并在新项目中填入同名环境变量。

---

## 1. 概览 / Overview

Helix Trading 的外部依赖分三类：

| 类别                 | 数量 | 是否需要密钥 | 说明                                        |
| -------------------- | ---- | ------------ | ------------------------------------------- |
| A. 托管服务 / 需密钥 | 3    | 是           | FMP 基本面、AI 网关、数据库 + Auth          |
| B. 免密钥公开接口    | 8 类 | 否           | 行情、SEC、Nasdaq、新闻 RSS、代码联想、链上 |
| C. AI 模型网关       | 1    | 是（同 A）   | 结构化 JSON 输出，简报 / 研究 / 翻译        |

所有外部请求**只允许在服务端执行**（server functions / edge runtime）。浏览器端永远不直接携带密钥。

---

## 2. 需要密钥的接口 / Keyed Services

### 2.1 `FMP_API_` — Financial Modeling Prep

| 项       | 内容                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 环境变量 | `FMP_API_KEY`                                                                                                                           |
| Base URL | `https://financialmodelingprep.com/api/v3` 与 `https://financialmodelingprep.com/stable`                                                |
| 用途     | 公司档案 `/profile`、财报日历 `/earnings`、季度利润表 `/income-statement`                                                               |
| 调用位置 | `src/lib/fundamentals.server.ts`                                                                                                        |
| 读取方式 | `process.env["FMP_API_KEY"]`，必须在 handler 内读取                                                                                     |
| 申请入口 | https://site.financialmodelingprep.com/developer/docs                                                                                   |
| 免费额度 | 约 250 请求/天（免费层），profile 与 income-statement 部分端点已转为付费                                                                |
| 已知问题 | **当前这把 key 返回 `401 Invalid API KEY`**（对 AAPL / CRWV 均复现）。交接时请申请新 key。                                              |
| 失败表现 | 401/403 → 公司档案退化为「无档案」，AI 研究报告字段大量 `unknown`。已加多源兜底（SEC + Yahoo metadata），但营收结构与机构预期精度下降。 |

### 2.2 可选免费行情 Key

以下 Key 均为可选项。未配置时不会报错，服务端会继续使用免密钥数据源、数据库历史缓存和离线种子数据。

| 环境变量                | 服务          | 用途                                           |
| ----------------------- | ------------- | ---------------------------------------------- |
| `TWELVE_DATA_API_KEY`   | Twelve Data   | 股票、指数、外汇、加密行情；优先使用其免费额度 |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage | 美股日线备用源                                 |
| `FINNHUB_API_KEY`       | Finnhub       | 美股日线备用源                                 |

三个 Key 都只允许配置在服务端环境变量中，不要添加 `VITE_` 前缀。免费套餐存在分钟/每日调用限制，项目通过 Supabase `market_cache` 降低重复调用。

### 2.3 `LOVABLE_API_KEY` — AI Gateway（本项目当前 AI 提供方）

| 项       | 内容                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| 环境变量 | `LOVABLE_API_KEY`                                                                  |
| Endpoint | `https://ai.gateway.lovable.dev/v1/chat/completions`（OpenAI 兼容格式）            |
| 模型     | `google/gemini-3.7-flash`（快，默认）、`google/gemini-3.1-pro-preview`（深度研究） |
| 用途     | 每日简报执行摘要、趋势信号解读、标的研究报告、新闻标题中文翻译、事件影响判定       |
| 调用位置 | `src/lib/ai.server.ts`（**全项目唯一 AI 出口**）                                   |
| 输出格式 | `response_format: { type: "json_schema", json_schema: { strict: true, schema } }`  |
| 迁移说明 | 见第 5 节 —— 换到 KIMI 只需改这一个文件。                                          |

### 2.4 Supabase / Postgres（数据库 + Auth + RLS）

| 环境变量                                                     | 用途                                   |
| ------------------------------------------------------------ | -------------------------------------- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL`                         | 项目地址                               |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | 浏览器端匿名/已登录访问（受 RLS 约束） |
| `SUPABASE_PROJECT_ID`                                        | 内部标识                               |
| service role key（平台托管，不可导出）                       | 服务端写 `market_cache`、跨用户任务    |

关键约束：

- 所有业务表 owner-only RLS（`auth.uid() = user_id`），每张 public 表必须显式 `GRANT`。
- `market_cache` **仅 `service_role` 可读写**，禁止任何 anon/authenticated 策略（这是一条已修复的安全项，请勿回退）。
- 用户角色若需要，必须存独立 `user_roles` 表 + `security definer` 的 `has_role()`，绝不能存在 profiles 上。

---

## 3. 免密钥公开接口 / Keyless Public Endpoints

### 3.1 多源免费行情

服务端按顺序自动尝试：

1. FRED（美股指数、利率、美元、黄金/白银/原油、汇率）或 Coinbase/CoinGecko（加密货币）；
2. Stooq（日线公开 CSV；若出口触发浏览器验证则自动跳过）；
3. Twelve Data、Alpha Vantage、Finnhub（仅在配置对应免费 Key 时调用）；
4. FMP 与 Yahoo Finance 兼容接口；
5. Supabase 长期历史缓存与内置离线指数数据。

任何单一数据源出现 401、402、403、429、超时或空数据，都不会直接令整个行情板块失败。

### 3.2 Yahoo Finance（末级在线兼容源）

| 端点                                                                          | 用途                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=&interval=` | K 线、最新价、涨跌幅、metadata（`shortName`/`longName`/`exchange`/`instrumentType`） |
| `https://query1.finance.yahoo.com/v1/finance/search?q=`                       | 标的新闻（`newsCount`）                                                              |
| `https://query2.finance.yahoo.com/v1/finance/search?q=`                       | 代码搜索联想                                                                         |
| `https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}`          | 机构/内部人持股模块                                                                  |

- 需带浏览器 `User-Agent`，否则易被拒。
- **限流严重**：高频会返回 `429`。已实现重试 + 冷缓存回落（429 时返回过期缓存而非报错）。
- 代码规范化：港股 `700 → 0700.HK`；A 股 `600519 → .SS`、`000001 → .SZ`；加密 `BTC → BTC-USD`；指数带 `^` 前缀。

### 3.3 SEC EDGAR（美股权威档案 / 内部人 / 机构）

| 端点                                                                       | 用途                                           | TTL    |
| -------------------------------------------------------------------------- | ---------------------------------------------- | ------ |
| `https://www.sec.gov/files/company_tickers.json`                           | 官方 ticker → CIK 全量目录，搜索兜底           | 7 天   |
| `https://data.sec.gov/submissions/CIK{cik}.json`                           | 公司名、交易所、SIC 行业、总部、财年、申报清单 | 7 天   |
| `https://data.sec.gov/api/xbrl/companyconcept/CIK{cik}/us-gaap/{tag}.json` | 财务概念（营收/净利）                          | 7 天   |
| `https://www.sec.gov/Archives/edgar/data/{cik}/{accession}`                | Form 4 内部人交易、13F 机构持仓原文            | 6 小时 |
| `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany`               | 机构名检索                                     | —      |

**必须设置带联系邮箱的 `User-Agent`**（SEC 强制要求，否则 403）。请求频率 ≤ 10 req/s。

### 3.4 Nasdaq 非官方 API（财报与日历）

| 端点                                                                                  | 用途                      | TTL     |
| ------------------------------------------------------------------------------------- | ------------------------- | ------- |
| `https://api.nasdaq.com/api/company/{ticker}/earnings-surprise` 等 `/api/company/...` | 历史财报实际值与超预期    | 12 小时 |
| `https://api.nasdaq.com/api/analyst/{symbol}/earnings-forecast`                       | 机构 EPS 预期、下次财报日 | 12 小时 |
| `https://api.nasdaq.com/api/calendar/economicevents?date=YYYY-MM-DD`                  | 宏观经济日历              | 15 分钟 |
| `https://api.nasdaq.com/api/calendar/earnings?date=YYYY-MM-DD`                        | 当日财报日历              | 15 分钟 |

非官方接口，随时可能变更。必须带 `User-Agent` + `Accept: application/json`，失败一律降级为「数据不可用」占位，禁止整页报错。展示链接回 `https://www.nasdaq.com/market-activity/...`。

### 3.5 新闻 RSS（头条与影响分析主力）

| 源                  | URL                                                      |
| ------------------- | -------------------------------------------------------- |
| CNBC Top News       | `https://www.cnbc.com/id/100003114/device/rss/rss.html`  |
| CNBC Markets        | `https://www.cnbc.com/id/20910258/device/rss/rss.html`   |
| CNBC Economy        | `https://www.cnbc.com/id/10000664/device/rss/rss.html`   |
| Investing.com       | `https://www.investing.com/rss/news_25.rss`              |
| Yahoo Finance       | `https://finance.yahoo.com/news/rssindex`                |
| Google News（备用） | `https://news.google.com/rss/search?q=...&hl=&gl=&ceid=` |

⚠️ **Google News RSS 在 Cloudflare Worker / 多数 serverless 出口 IP 上被拦截**，返回空。因此主力是 CNBC + Investing + Yahoo；Google News 只作为可选补充。新闻缓存 5 分钟。

### 3.6 代码联想

`https://api.stocktwits.com/api/2/search/symbols.json?q=` —— 输入 `TSLA` 类前缀时给出候选。限流时降级到本地别名表 + SEC 目录。

### 3.7 链上大额转账

| 端点                                                              | 用途                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `https://mempool.space/api/mempool/recent`                        | BTC 近期大额转账（详情页 `https://mempool.space/tx/{txid}`）  |
| `https://eth.blockscout.com/api/v2/transactions?filter=validated` | ETH 大额转账（详情页 `https://eth.blockscout.com/tx/{hash}`） |

---

## 4. 缓存与降级策略 / Cache & Degradation

统一走一张 `market_cache(key text primary key, payload jsonb, expires_at timestamptz)` 表，服务端 `readCache/writeCache`。

| 数据类别                      | 缓存键前缀                                   | TTL                          |
| ----------------------------- | -------------------------------------------- | ---------------------------- |
| 指数看板快照                  | `index_board_*`                              | 10 分钟                      |
| 简报行情快照                  | `macro_snap_*`                               | 15 分钟                      |
| 简报市场数据                  | `macro_market_*`                             | 5 分钟                       |
| 头条新闻                      | `macro_headlines_live_v2_*` / `news_macro_*` | 5 分钟                       |
| 宏观日历                      | `macro_calendar_*`                           | 15 分钟                      |
| 公司档案                      | `company_profile_v2_*`                       | 命中 7 天 / 空档案 30 分钟   |
| SEC ticker 目录               | `sec_catalog_*`                              | 7 天                         |
| 代码解析结果                  | `resolved_symbol_v1_*`                       | 验证成功 7 天 / 失败 15 分钟 |
| 代码搜索联想                  | `symbol_search_v4_*`                         | 24 小时                      |
| 财报事实 / 预期 / 反应        | `earnings_*`                                 | 12 小时                      |
| 资金流（Form 4 / 13F / 链上） | `flows_*`                                    | 6 小时                       |
| 季节性                        | `seasonality_*`                              | 24 小时                      |
| 事件窗口                      | `events_window_*`                            | 15 分钟                      |
| 新闻标题中文翻译              | `tr_zh_{hash}`                               | 30 天                        |

降级规则（**强制**）：

1. `429` → 先重试（指数退避），仍失败则返回**过期缓存**；无缓存则该卡片显示「数据暂不可用」。
2. `5xx` / 超时 → 同上，单模块降级，**绝不整页报错**。
3. `401/403`（如 FMP）→ 记录明确错误，不得静默吞掉；该数据源当次视为缺失，由其他源补齐。
4. 任何缺失字段传给 AI 时必须是 `unknown` / `null`，AI **禁止编造数字**。
5. 代码无法验证（行情与 SEC 均查无此标的）→ 明确报错，**不生成 AI 猜测报告**。

---

## 5. 迁移到 KIMI / Moonshot / Moonshot 兼容网关

全项目 AI 调用集中在 `src/lib/ai.server.ts` 的 `aiJson()` 一个函数，改动点只有三处：

```ts
// 1) endpoint
const GATEWAY = "https://api.moonshot.cn/v1/chat/completions";
// 2) 模型名
export const AI_MODEL_FAST = "kimi-k2-turbo-preview";
export const AI_MODEL_DEEP = "kimi-k2-0905-preview";
// 3) 密钥环境变量
const apiKey = process.env["MOONSHOT_API_KEY"];
```

请求体保持 OpenAI 兼容（`model` / `messages` / `response_format`）。

**结构化输出兼容性注意：**

- 若目标模型不支持 `json_schema` + `strict: true`，退回 `response_format: { type: "json_object" }`，并在 system prompt 里内联完整 JSON Schema，外加服务端 Zod 校验；校验失败重试一次，仍失败则该模块降级为「AI 内容暂不可用」。
- 需要保留的全局 guardrails（在 `ai.server.ts` 里）：事实/推演 `kind` 区分、`source` + `as_of` + `confidence` 必填、无依据一律 `unknown`/`null`、禁止买卖建议与目标价、注明训练数据截止。
- 标题翻译是批量调用 + 逐条 30 天缓存，失败必须原样回退英文标题，**绝不丢标题**。

错误码映射（对用户的文案）：402 额度用尽 / 403 被策略禁用 / 429 过于频繁 / 5xx 服务不可用。

---

## 6. 迁移到 Base44 / 其他 serverless 平台

- **运行时是 edge/Worker，不是完整 Node**：不可用 `child_process`、`sharp`、native addon、文件监听。所有依赖必须能在构建时完整打包。
- **本地网关型券商 API 不可用**：moomoo OpenAPI 需要本机 OpenD 网关进程，云端环境无法调用。券商/交易所持仓同步（moomoo / Bitget / Robinhood）只能走「本地连接器」或「只读 API 授权」路径，属 Phase 5 可选项。
- **出口 IP 会被部分源封锁**：Google News RSS 已确认被拦截；Yahoo 易 429。部署后必须逐个冒烟测试，不要假定沙箱可用即线上可用。
- **密钥只存服务端**：`process.env` 必须在 handler 内读取（模块顶层读取可能拿到 undefined）；浏览器端只用 `VITE_*` 公开变量。
- **cron / webhook** 用公开 HTTP 路由（如 `/api/public/*`）承接，并在 handler 内自行校验调用方（签名或共享密钥），路由前缀本身不提供鉴权。

---

## 7. 接手方 Checklist

- [ ] 申请并配置 `FMP_API_KEY`（旧 key 已失效，必须换新）
- [ ] 配置 AI 密钥（`MOONSHOT_API_KEY` 或等价）并改写 `ai.server.ts` 的 endpoint / 模型名
- [ ] 配置数据库 URL + publishable key + service role key
- [ ] 建 `market_cache` 表并确认**仅 service_role 可访问**
- [ ] 建全部业务表 + owner-only RLS + 显式 GRANT
- [ ] 冒烟测试：Yahoo chart（AAPL / 0700.HK / 600519.SS / BTC-USD）
- [ ] 冒烟测试：SEC company_tickers + submissions（确认 User-Agent 带邮箱）
- [ ] 冒烟测试：Nasdaq 四个端点（财报历史 / EPS 预期 / 经济日历 / 财报日历）
- [ ] 冒烟测试：5 个新闻 RSS 源逐个可达（Google News 允许失败）
- [ ] 冒烟测试：Stocktwits 联想 + 链上两个端点
- [ ] 验证 AI 结构化 JSON 输出通过 schema 校验，且缺数据时返回 `unknown` 而非编造
- [ ] 验证标题翻译缓存命中与英文回退
- [ ] 验证任一数据源人为置失败时，只降级单个卡片、不整页崩溃

---

## 8. 免责声明

Helix Trading 是交易**决策辅助与纪律管理**工具：不自动下单、不代客理财、不提供投资建议、不荐股。所有 AI 输出必须在页面顶部与底部展示免责声明。
