# 项目变更记录

本文件按时间点记录项目中所有文件修改。只要修改项目文件，都必须在变更发生时追加记录。

## 2026-09-19

### 2026-09-20：改进 PPT 生成脚本的输出路径配置

- 修改范围：`scripts/create_multi_agent_pitch_deck.mjs`、`docs/change-log.md`。
- 具体变更点：移除项目绝对路径硬编码，改为根据脚本位置解析项目根目录；支持通过 `HELIX_PRESENTATION_DIR` 覆盖项目外 PPT 输出目录，默认仍使用相邻的 `helix trading-presentation` 文件夹。
- 验证结果：已重新生成外部 PPTX，包完整性检查通过，共 3 页。

### 2026-09-20：按需求更新实时市场、日历、财报与事件研究

- 修改范围：指数看板、宏观日历与新闻、行情自动刷新、财报事实数据、周期性事件时间轴及相关组件与服务端模块。
- 具体变更点：新增全球指数 3D 旋转地球展示；行情、新闻和看板每 60 秒自动刷新；宏观日历改为未来一周高重要性事件并展示完整标题、AI 影响方向与影响板块；财报事实层增加营收/净利润同比字段；周期性事件按时间顺序排列，历史事件显示发布后下一交易日涨跌，未来事件显示利多/利空/中性预测。
- 验证结果：`npm run lint` 通过；`npm run build` 通过并生成 Vercel Nitro 输出。

### 2026-09-19：接入多源免费行情自动回退

- 修改范围：`src/lib/market.server.ts`、`src/lib/market-api.server.ts`、`src/lib/market-seed.ts`、行情相关页面与研究提示、`docs/api-handoff.md`。
- 具体变更点：接入 FRED、Coinbase、CoinGecko、Stooq 免密钥行情，并支持可选的 Twelve Data、Alpha Vantage、Finnhub 免费 Key；保留 FMP、Yahoo、Supabase 长期历史缓存和内置种子作为后续回退；每个远端请求增加 6 秒超时，单一来源 401/402/403/429、超时或空数据不会令整个板块失败；页面展示实际命中的数据源并更新缓存版本。
- 验证结果：FRED CSV 与 Coinbase candles 实测均返回 HTTP 200；Stooq 当前出口触发浏览器验证但已能自动跳过；TypeScript 检查通过，定向 ESLint 无错误（仅 1 条既有 Hooks 警告），7 个测试文件共 82 项测试通过，生产构建通过。

### 2026-09-19：将 PPT 及关联讲解稿移出项目目录

- 修改范围：`scripts/create_multi_agent_pitch_deck.mjs`、`AGENTS.md`、`docs/change-log.md`；外部目录 `/Users/farnlyluo/Documents/helix trading-presentation/`。
- 具体变更点：将 PPT、PPT 生成时的临时包和评委讲解稿统一移到项目目录外的同一文件夹；生成脚本改为直接输出到该外部目录；项目规则明确这些产物不纳入项目文件。
- 验证结果：项目目录不再包含 PPT 及讲解稿；生成脚本已成功写入外部目录，外部 PPTX 包完整性检查通过，包含 3 页。

### 2026-09-19：执行期间发现其他既有工作区变更

- 修改范围：`docs/api-handoff.md`、`docs/harness-multi-agent.md`、`package.json`、`src/components/macro/MacroCalendar.tsx`、`src/components/GlobalIndexGlobe.tsx`、`src/lib/macro-briefing.news.server.ts`、`src/lib/macro-briefing.types.ts`、`src/lib/market-api.server.ts`、`src/lib/market-seed.ts`、`src/lib/market.server.ts`、`src/lib/research-harness.server.ts`、`src/lib/research-harness.test.ts`、`src/lib/research.server.ts`、`src/lib/seasonality.server.ts`、`src/routes/accounts.tsx`、`src/routes/index.tsx`、`src/routes/journal.tsx`、`src/routes/markets.$symbol.tsx`、`src/routes/markets.index.tsx`、`src/styles.css`。
- 具体变更点：本次文档任务执行期间发现上述文件存在未提交修改；这些内容并非本次讲解稿任务产生，本次未改写其代码或文档内容。
- 验证结果：已通过 `git status --short` 确认范围；本次新增文档通过 `git diff --check`。

### 2026-09-19：新增 Multi-Agent PPT 评委讲解稿

- 修改范围：`AGENTS.md`、`docs/pitch-talk-track.md`、`docs/change-log.md`。
- 具体变更点：将 PPT 的 3 分钟讲解结构、逐页讲稿、结尾、评委追问和核心表述整理为独立 Markdown 文档；补充规则，要求今后更新 PPT 或生成脚本时同步更新讲解稿。
- 验证结果：已检查文档与 PPT 当前 3 页内容一致，Markdown 格式检查通过。

### 2026-09-19：更新 Multi-Agent 路演 PPT 的工程闭环内容

- 修改范围：`scripts/create_multi_agent_pitch_deck.mjs`、`deliverables/helix_multi_agent_pitch_deck.pptx`、`docs/change-log.md`。
- 具体变更点：在 Harness 与应用工作流页加入 30 分钟 MVP 工程闭环、`npm run verify` 门禁、fallback/verifier 流程及 7 个测试文件共 82 项测试通过的验收结果；保持原有 3 页结构与深色科技风布局。
- 验证结果：PPTX 包完整性检查通过；3 页、16:9 尺寸与布局几何检查通过，无发现重叠或标题适配问题。

### 2026-09-19：执行期间发现既有工作区变更

- 修改范围：`src/routes/journal.tsx`。
- 具体变更点：本次最小工程闭环执行期间发现该文件出现未提交修改，内容涉及新建交易记录前的登录和账户状态检查；本次未改写该文件，也不推断其来源。
- 验证结果：已通过 `git diff --stat` 和文件差异确认变更范围；项目 TypeScript 检查与测试通过。

### 2026-09-19：建立 Multi-Agent MVP 最小工程闭环

- 修改范围：`src/lib/research-harness.server.ts`、`src/lib/research-harness.test.ts`、`package.json`、`docs/harness-multi-agent.md`、`docs/change-log.md`。
- 具体变更点：修复事实验证器对数值型 grounding 的误报；补充 Synthesizer 失败回退及 inference 不参与事实校验的 smoke 测试；新增 `lint:harness`、`test`、`test:watch`、`typecheck`、`verify` 命令，并记录提交前最小质量门槛。
- 验证结果：Harness 定向 ESLint、项目 TypeScript 检查及 7 个测试文件共 82 项测试均通过；全项目 `npm run lint` 另发现约 2400 个既有格式/规则问题，不纳入本次 30 分钟 MVP 门禁。

### 2026-09-19：修复路演 PPT 文字重合

- 修改范围：`scripts/create_multi_agent_pitch_deck.mjs`、`deliverables/helix_multi_agent_pitch_deck.pptx`。
- 具体变更点：为所有文本框补充明确的内边距、段落行距、段落结束样式和自动适配设置，避免 PowerPoint 将多行文本重叠渲染；重新生成路演 PPT。
- 验证结果：重新生成 PPTX，并通过演示文稿压缩包完整性校验；共 3 页。

### 2026-09-19：创建 Multi-Agent 路演演示文稿

- 修改范围：新增 `scripts/create_multi_agent_pitch_deck.mjs` 与 `deliverables/helix_multi_agent_pitch_deck.pptx`。
- 具体变更点：将 Multi-Agent fundamentals 流程、Harness 能力和应用层工作流整理为 3 页深色科技风路演材料；保留可编辑文本框、圆角框和连接线。
- 验证结果：已生成 PPTX 文件并检查压缩包结构；待使用 PowerPoint 打开进行最终视觉确认。

### 2026-09-19：发现既有工作区变更

- 修改范围：`AGENTS.md`、`docs/change-log.md`、`src/lib/market-api.server.ts`、`src/lib/market.server.ts`。
- 具体变更点：本次检查开始时发现上述文件存在未提交修改；这些修改并非本次问答产生，本次未对其代码内容做任何改写。
- 验证结果：已通过 `git status --short` 和 `git diff --stat` 确认工作区状态；未运行构建或测试，因为本次仅回答部署限制问题。

### 2026-09-19：按时间点记录变更

- 修改范围：`AGENTS.md`、`docs/change-log.md`。
- 具体变更点：移除按会话区分的记录方式，改为按变更发生或发现的日期（必要时精确到时间）记录；同步将既有日志标题改为日期标题。
- 验证结果：已检查规则与日志标题，未发现按会话区分的表述；工作区无未提交文件。

### 2026-09-19：建立持续变更记录机制

- 更新 `AGENTS.md`，约定所有会话只要修改项目文件，就必须同步更新本文件。
- 新增本文件作为项目统一变更日志，并补录本次会话已完成的图标替换、每日简报导航调整，以及工作区中已存在的行情缓存相关修改。

### 2026-09-19：品牌图标替换

- 新增 `public/favicon.svg`，使用 Helix Trading 深色青绿色交易符号作为浏览器图标。
- 删除旧的 `public/favicon.ico`，移除原 Lovable 默认图标。
- 更新 `src/routes/__root.tsx`，将 favicon、alternate icon 和 apple touch icon 全部指向新的 SVG。
- 验证：`npm run lint` 通过；`npm run build` 因本机缺少 `rolldown` 原生 binding 未完成，属于环境依赖问题。

### 2026-09-19：每日简报导航布局

- 更新 `src/components/macro/MacroBriefingHeader.tsx`，让主导航使用与其他页面一致的 Helix Trading 顶栏结构，并保持顶部吸顶。
- 将“每日宏观简报”的日期、更新时间、刷新、偏好和时区操作移到主导航下方，避免切换到每日简报时导航行下移。
- 为当前导航项增加背景高亮和 `aria-current="page"`。
- 更新 `src/routes/briefing.index.tsx`，将桌面端右侧栏吸顶偏移调整为 `top-16`，与统一顶栏高度匹配。
- 更新 `src/styles.css`，隐藏简报导航横向滚动条并保留触控滚动能力。
- 验证：`npm run lint` 通过，`git diff --check` 通过。

### 既有工作区变更（本会话开始前已存在）

- `src/lib/market-api.server.ts`：为指数看板增加无有效行情时读取过期缓存的兜底。
- `src/lib/market.server.ts`：增加过期缓存读取、历史行情持久缓存、Financial Modeling Prep 备用行情源及 Yahoo 请求失败回退逻辑。
- `src/lib/market-seed.ts`：新增主要指数的离线历史行情种子数据，作为实时行情和缓存均不可用时的安全兜底；该文件在本会话进行状态复核时发现，未由本会话创建。
