# Helix Trading — Master Rebuild Prompt

如何使用：复制下面代码块里的**全部内容**，粘贴给任意 AI 构建工具（Claude Code / Lovable / Bolt / v0 / Cursor / Replit Agent / Base44 …）。它是自包含的端到端重建规格，不依赖本仓库源码。若目标平台技术栈不同，提示词内已写明「映射到等价能力」的规则。

````text
You are a senior full-stack engineer + fintech product architect. Rebuild an application called
**Helix Trading** end-to-end from this specification. Do not ask me to clarify basics — this document
is the source of truth. Where a detail is unspecified, choose the option a careful professional would
and note the choice in your final summary.

Helix Trading is an **AI-assisted trading DECISION-SUPPORT and TRADING-DISCIPLINE tool** for an
individual active trader who holds **US equities, Hong Kong equities, and crypto simultaneously**.
It aggregates information, produces structured analysis, and enforces a trading checklist/journal.

NON-GOALS (never build these): order placement / execution, custody of funds, discretionary money
management, buy/sell signal recommendations, social copy-trading, tick-level or HFT market data.

Core value proposition: **every trade must have a structured fundamental rationale + an event
calendar + a discipline check.**

The primary UI language is **Simplified Chinese**, with a full **English** toggle. All UI copy quoted
in this spec in Chinese must appear verbatim in the zh locale.

====================================================================
1. TECH STACK (portable)
====================================================================
Reference stack (use it if your platform supports it):
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS + TanStack Router (file-based routes) +
  TanStack Query (route-loader prefetch, `ensureQueryData` + `useSuspenseQuery`).
- Backend: typed server functions (RPC) co-located with the app — NOT a separate service. Public HTTP
  routes only for cron and webhooks, under `/api/public/*`, each validating a shared-secret header.
- Data: Postgres with Row Level Security, email/password + Google auth, object storage for CSV
  imports and exports.
- AI: a single AI gateway; default `google/gemini-3-flash` for summarization/attribution/translation,
  `google/gemini-3-pro` for deep research.
- Runtime constraint: server code runs in an **edge/serverless worker** — no child_process, no native
  binaries (sharp/canvas/puppeteer), no filesystem watching, no runtime module resolution. Everything
  must bundle at build time.

MAPPING RULE: if your platform uses a different router, ORM, or backend primitive, map each concept
to the closest equivalent (file routes → your routing, server functions → your API layer/edge
functions, RLS → your row-level authorization). Never silently drop a capability.

Secrets: all third-party API keys live server-side only. The browser never sees them.

====================================================================
2. DATA MODEL
====================================================================
All tables live in the `public` schema. For EVERY table: create it, then GRANT privileges to the
roles your policies allow, then ENABLE ROW LEVEL SECURITY, then create policies. Default posture is
**owner-only**: a row is readable/writable only by `user_id = auth.uid()`. Cache tables are
**service-role only** (no anon, no authenticated read).

Never store roles on a profile/user table. If roles are needed, use a separate `user_roles` table
plus a security-definer `has_role(user_id, role)` function, and check roles through that function.

Tables:

profiles
  id uuid PK -> auth user id, display_name text, locale text default 'zh',
  timezone text default 'Asia/Shanghai', base_currency text default 'USD',
  created_at timestamptz default now()

accounts
  id uuid PK, user_id uuid, name text, broker text null, base_currency text default 'USD',
  timezone text default 'Asia/Shanghai', is_default boolean default false, created_at

holdings
  id uuid PK, user_id, account_id, symbol text, market text check in ('US','HK','CN','CRYPTO'),
  display_name text null, sector text null, quantity numeric, avg_cost numeric,
  currency text, stop_loss numeric null, max_weight_pct numeric null, note text null,
  created_at, updated_at
  unique (account_id, symbol)

transactions
  id uuid PK, user_id, account_id, symbol, market, side text check in ('buy','sell'),
  quantity numeric, price numeric, fee numeric default 0, currency text,
  traded_at timestamptz, source text default 'manual', created_at

journal_entries
  id uuid PK, user_id, account_id, symbol, market, status text check in ('open','closed'),
  thesis text, entry_reason text, exit_reason text null, emotion text null,
  planned_stop numeric null, planned_target numeric null, opened_at, closed_at null,
  checklist_run_id uuid null, result_pnl numeric null, created_at

checklist_templates
  id uuid PK, user_id, name text, items jsonb  -- [{id,label,required:boolean}]
  is_default boolean, created_at

checklist_runs
  id uuid PK, user_id, template_id, symbol, answers jsonb, passed boolean, created_at

risk_rules
  id uuid PK, user_id, account_id null, symbol null, max_position_pct numeric null,
  max_sector_pct numeric null, stop_loss_pct numeric null, daily_loss_limit numeric null

watchlist_indexes
  id uuid PK, user_id, symbol text, label text, sort_order int, created_at
  -- user-customizable index board; seeded defaults listed in section 5.

briefings
  id uuid PK, user_id, account_id null, briefing_type text check in ('macro','portfolio'),
  briefing_date date, generated_at timestamptz, locale text, timezone text,
  holdings_hash text null, payload jsonb
  unique (user_id, briefing_type, briefing_date, coalesce(account_id,'...'), locale)

research_reports
  id uuid PK, user_id, symbol text, market text, section text
    check in ('fundamentals','earnings','seasonality','flows'),
  window_days int null, locale text, payload jsonb, generated_at, expires_at
  -- cache key: symbol + section + window + locale + data version

event_impacts
  id uuid PK, user_id, event_key text, event_title text, event_time timestamptz,
  predicted_direction text check in ('bullish','bearish','neutral','mixed'),
  predicted_scope jsonb,        -- [{target, direction, rationale}]
  actual_direction text null, returns jsonb null,   -- {d1, d5, d20} per target
  portfolio_impact numeric null, reviewed_at null, created_at

market_cache
  key text PK, payload jsonb, expires_at timestamptz
  -- SERVICE ROLE ONLY. No anon/authenticated SELECT policy. All reads go through server code.

fx_rates
  date date, base text, quote text, rate numeric, primary key (date, base, quote)
  -- readable by authenticated, written by service role.

====================================================================
3. ROUTES & PAGES
====================================================================
Every page: define its own SEO head (unique title < 60 chars, description < 160 chars, og:title,
og:description, og:type, twitter:card). Every page has explicit loading (skeleton), empty, and error
states. A failing external data source degrades to a "数据暂不可用" placeholder card — never a
full-page crash.

/auth
  Email+password sign-in/sign-up and Google OAuth. No anonymous sign-up. Redirect target is a
  same-origin URL (`window.location.origin`), and the intended destination is stored separately and
  navigated to only after the session hydrates.

/  交易台 (Trading Desk)
  KPI row: 总市值 / 总成本 / 浮动盈亏 (amount + %) / 持仓数 与 进行中交易数.
  今日持仓波动: top 5 holdings by absolute % change, with weight.
  全球指数速览: latest-session change for the user's watchlist, links into /markets/$symbol.
  最新简报: latest briefing summary excerpt + link to /briefing.
  板块分布: sector weight bars + market weight badges.
  Header line: 账户 {name} · 基准货币 {base} · 展示时区 {tz}.

/briefing            每日宏观简报  (see section 4 — this is the flagship feature)
/briefing/portfolio  持仓定制简报: same card grammar but scoped to the user's actual holdings and
                     sectors, plus 观察要点 and an upcoming-trading-day event calendar for held names.

/markets       指数看板: customizable board, past 5 trading days of daily % change per index plus a
               one-sentence AI attribution per index. Add/remove/reorder entries (persisted in
               watchlist_indexes). Also a 月度最佳表现排行榜 (monthly best performers, filterable,
               expandable chart) computed from historical candles: win rate + average return.
/markets/$symbol  chart page with 1D / 5D / 1M / 3M / 1Y ranges.

/research      标的深度研究  (see section 6)
/accounts      账户与持仓: create/switch/edit accounts; manual holding entry + CSV import with
               downloadable template, field-mapping preview, and per-row validation errors.
               Multi-currency positions convert to the account base currency using daily FX.
/journal       交易纪律: pre-trade checklist run, buy/sell rationale, trade log, position-size cap and
               stop-loss reminders, open/closed filtering.
/impacts       事件影响复盘: each recorded event shows AI-predicted direction/scope vs. realized
               direction, D+1/D+5/D+20 returns of the affected targets, and the impact on the user's
               portfolio. Aggregate: prediction hit rate.

Global chrome: persistent left/top nav shared by every page (single source of truth for nav items),
language toggle, timezone selector, base-currency selector, account switcher, and a fixed footer
disclaimer.

====================================================================
4. DAILY MACRO BRIEFING  (the flagship — implement exactly)
====================================================================
The briefing page renders SIX cards, always in this order:

  1. 执行摘要 (Executive Summary)
  2. 全球市场概览 (Global Market Overview)
  3. 板块与主题轮动 (Sector & Theme Rotation)
  4. AI 趋势信号 (AI Trend Signals)
  5. 宏观财经日历 (Macro Economic Calendar)
  6. 头条新闻与影响分析 (Top Headlines & Impact Analysis)

4.1 Trading-day anchoring and time display
- The briefing's trading day is anchored to the **latest completed S&P 500 session**, not to the
  user's wall clock. Show it as an **US Eastern Time (ET)** trading date.
- Never auto-convert a session close timestamp into the viewer's local timezone — that produced a
  wrong date. Session/close context is ET.
- News and calendar items are **event timestamps** and DO get rendered in the user's chosen IANA
  timezone, with the ET equivalent shown alongside.
- The user selects their own IANA timezone; default 展示时区 Asia/Shanghai.

4.2 执行摘要
- 600–900 Chinese characters, **content-driven length** (do not pad to hit the ceiling).
- **No throat-clearing opener.** Forbidden: "今天市场表现分化…", "总体来看…", generic scene-setting.
  The first sentence must name concrete markets: which markets rebounded and which led losses, with
  numbers.
- Structure: 市场表现 → 驱动因素（事件/数据/政策）→ 板块含义 → 需要关注的风险与日程.
- Every factual claim carries a source and an `as_of` timestamp; every projection is labeled as
  inference with a confidence level.

4.3 全球市场概览
- Grid of index/asset rows with **percentage change only, two decimal places**.
- **Do NOT attach 利多/利空 tags here** — this card is pure price movement.
- Colors: up = green token, down = red token (semantic tokens, never hardcoded).

4.4 板块与主题轮动
- Market tabs: 美股 / 港股 (extensible). Switching the tab swaps the sector universe (US GICS sector
  ETFs vs. HK industry indices).
- Per sector: period return, relative strength vs. the market, and a one-line driver.

4.5 AI 趋势信号
- Each signal states the observation, then an explicit **利多 / 利空 / 中性** interpretation with the
  affected market or sector, plus confidence.

4.6 宏观财经日历
- Next ~48 hours of macro events: event name, release time (user tz + ET), country/region,
  previous/consensus/actual when available, expected sector impact, and a **link to the source**.

4.7 头条新闻与影响分析
- **Maximum 5 items**, the most important and most recent of the day.
- Ranking priority: 政策/央行 > 通胀与就业数据 (CPI/PCE/NFP) > 地缘政治 > 重磅财报 > 权重股个股新闻.
  Break ties by recency.
- Sources: reputable finance RSS feeds reachable server-side (e.g. CNBC, Investing.com, Yahoo
  Finance). Do NOT rely on Google News RSS — it is blocked from edge runtimes.
- **Translate each headline to Chinese with the AI gateway** (batched, cached 30 days). On translation
  failure fall back to the original English headline — never drop the item.
- Each item shows: 中文标题, 发布时间 (user tz + ET), 来源, 一句话解读, and 「查看原文」 linking out with
  the original English title.
- **A single news item may be bullish for one sector and bearish for another (or several).** The
  impact model must support multiple directional scopes per item; render all of them, e.g.
  `利多 能源` + `利空 航空`.

4.8 Freshness, sources, and refresh
- Auto-refresh cadence: briefing data every 15 minutes; news cache TTL 5 minutes; quotes ~60s.
- Every card displays its **data fetch time**, and clicking expands a source detail panel listing each
  underlying source with its own URL and update timestamp.
- A manual 刷新 button in the page header. Before refreshing, show a confirmation dialog restating the
  current **display timezone** and **base currency** so the user can correct them first.
- Inline glossary: financial jargon renders with a hover/tap explanation (e.g. VIX 恐慌指数, PCE, 缩表,
  倒挂). Keep the glossary in one shared module.
- Briefings persist to `briefings` and are re-readable as history; the portfolio briefing is cached by
  account + date + holdings hash and is not recomputed when holdings are unchanged.

====================================================================
5. INDEX BOARD DEFAULTS
====================================================================
Seed these, and let the user add/remove/reorder any symbol:
SPX, NDX, DJI, RUT, HSI, **HSTECH (恒生科技)**, CSI300, N225, DAX, **GOLD (XAU/黄金)**, **BTC**, ETH,
DXY, VIX, US10Y.
Each row: label + code, last 5 trading days of % change, and a one-sentence AI attribution cached per
(date, symbol).

====================================================================
6. 标的深度研究 (Deep Research)
====================================================================
User enters a symbol (with autocomplete), picks a market and a flow window; the app generates four
sections, each cached and each carrying sources + timestamps.

6.1 公司简介 / 基本面
- 公司全称、交易所、行业、总部、成立年份、市值、员工数、一句话主营业务、详细业务概览.
- **按业务线营收占比、按产品线营收占比、按地区营收占比 — each line item MUST include an explicit
  percentage (%) and the absolute amount when available**, plus the fiscal period the split covers.
- **同行对比：竞争力与差异化** — named peers, comparison on growth / margin / valuation / market
  share, and what genuinely differentiates this company (or an explicit "无明显差异化" if not).

6.2 财报分析
- Last 3 reports, each with: **发布日期**, **实际营收**, **实际净利润**, **此前机构一致预期 (revenue &
  EPS/net income)**, and **较预期的差额 — both absolute amount and percentage**, marked beat/miss.
- Post-earnings price reaction: **1 日 / 5 日 涨跌幅**.
- 下次财报日期 + 当前一致预期.

6.3 行业周期与季节性
- Monthly historical performance table (average return + win rate per calendar month), identified
  旺季/淡季, and the events around the report window (前后一个月的相关事件).

6.4 资金流向
- Institutional 13F changes, insider Form 4 transactions (name, role, buy/sell, size, date), and for
  crypto on-chain whale movement (explicitly low-confidence when derived from heuristics).
- Window selector: 30 / 90 / 180 / 365 天, default 90.
- **Explain what the window means** in the UI: "窗口 = 统计区间。90 天窗口表示只统计最近 90 天内披露/
  发生的机构持仓变动与内部人交易；窗口越短越贴近当前情绪，越长越能反映趋势性建仓或减持。"

====================================================================
7. SYMBOL RESOLUTION & SEARCH
====================================================================
Build one shared resolution layer used by search, research, holdings, and the index board.

Normalization rules:
- HK: `700` or `0700` -> `0700.HK` (strip leading zeros, pad to 4, append .HK).
- CN: `600519` -> `600519.SS`; `000001` -> `000001.SZ` (6xxxxx/5xxxxx -> .SS, else .SZ).
- Crypto: `BTC` -> `BTC-USD`.
- Anything already containing `.`, `-`, or a leading `^` passes through untouched.

Resolution sources, merged and de-duplicated, in priority order:
1. quote/chart metadata (long name, short name, exchange, instrument type)
2. the official regulator ticker catalog (e.g. SEC ticker->CIK file) and issuer submissions profile
3. a symbol search API
4. a small local alias table (e.g. 招商银行, 腾讯, 茅台 -> code)

Rules:
- Autocomplete fires as the user types and shows 代码 + 公司名 + 交易所 + 市场.
- **Numeric HK/CN codes must always render with the company name** everywhere in the app.
- If suggestion providers are rate-limited or fail, still let the user submit a full code directly and
  show: "搜索服务暂时不可用，仍可输入完整代码后直接研究" / "未找到联想结果；若代码无误，可按回车直接验证".
- If a symbol cannot be verified by ANY source, show a clear error and **do not generate an AI report
  based on guesses**. Never let the model invent a company.
- Cache verified resolutions long (7 days) and unverified ones briefly (15 minutes) so a transient
  rate-limit never poisons the cache.
- Company profiles merge multiple providers field-by-field; a missing field stays empty rather than
  being filled by the model. Cache a "low information" profile for only 30 minutes so it self-heals.

====================================================================
8. DATA SOURCES & DEGRADATION
====================================================================
| Domain | Primary | Fallback | Cache TTL |
| US quotes/fundamentals/earnings | fundamentals API (e.g. FMP) | Yahoo chart + regulator XBRL filings | quotes 60s, profile 7d |
| HK quotes | market API with `.HK` codes | Yahoo | 5–15 min |
| CN / global indices | market data API | Yahoo | 5–15 min |
| Crypto | CoinGecko free tier (60 req/min) | exchange public REST | 60s |
| Insider / institutional | regulator full-text + submissions API (needs a descriptive User-Agent) | — | 6–24h |
| On-chain whales | public explorer + large-transfer heuristics, LOW CONFIDENCE, labeled as such | — | 1h |
| Earnings estimates | exchange estimate endpoints (e.g. Nasdaq) | regulator XBRL actuals | 12h |
| Macro calendar | economic calendar API | — | 30 min |
| News | CNBC / Investing.com / Yahoo Finance RSS | — | 5 min |
| FX | daily rates API | last known rate, flagged stale | 1 day |

Rules:
- All external calls go through server code; write results into `market_cache`.
- Retry only on 429/5xx with backoff; on hard failure serve the last good cache and label it stale.
- Never let a failed provider produce a fabricated value. Missing = missing.
- Log auth failures (401 from a provider) loudly instead of swallowing them — a silently dead API key
  must not degrade into "this company doesn't exist".

====================================================================
9. AI LAYER RULES
====================================================================
- All model calls go through one gateway module. Default `google/gemini-3-flash`
  (summaries, attribution, translation); `google/gemini-3-pro` for deep research.
- **Strict structured output** (JSON Schema). Every fact-bearing field carries:
  `source_url`, `as_of`, `confidence` (0–1), and `kind: "fact" | "inference"`.
- If the grounding data is missing, the model MUST return `unknown`. Fabricating numbers is a
  hard failure. Prefer skipping the model call entirely when the data isn't there.
- Fetch data FIRST, then prompt the model with that data as grounding. Never let the model retrieve.
- Three-tier caching: index attribution per (date, symbol) for one trading day; research per
  (symbol, section, window, locale, data version) for 24h (invalidated on an earnings date); briefings
  per (user, type, date, locale, holdings hash).
- Per-user daily call quota; batch similar requests.
- Headline translation is a separate cheap call, batched, cached 30 days, English fallback on failure.

====================================================================
10. DESIGN SYSTEM (cyberpunk terminal)
====================================================================
- Palette: **neon light green `#39FF88`** as the accent, near-black background, light-grey text and
  surfaces. Up = `#2A9D8F`, Down = `#E63946`.
- Type: **Space Grotesk** for headings/UI, tabular monospaced numerals for every number.
- Aesthetic: dark trading-terminal, thin neon hairlines, subtle glow on the accent, dense data grids,
  Lucide SVG icons only.
- **Forbidden**: purple/indigo gradients on white, Inter/Poppins defaults, emoji as UI iconography,
  raster icon images.
- Every color, gradient, and shadow is a **semantic design token** defined in the global stylesheet
  and consumed through component variants. Never hardcode `text-white`, `bg-black`, or `bg-[#...]`
  in a component. Green-up/red-down are tokens too.
- Layout is responsive; number columns stay right-aligned and tabular at every breakpoint.

====================================================================
11. I18N & USER PREFERENCES
====================================================================
- Language: 简体中文 / English toggle, persisted per user. The locale is part of every AI cache key so
  switching languages does not serve the wrong text.
- Timezone: any IANA zone, default Asia/Shanghai; event times render in it, with ET alongside.
- Base currency: USD / CNY / HKD; portfolio values convert with daily FX and the base is labeled next
  to every aggregate figure.
- Briefing preferences: the user picks the markets and sectors they care about, and can also **type
  free-form keywords** (e.g. "AI 芯片", "美债", "稳定币"), which bias headline selection, sector
  rotation, and the executive summary.
- The index board watchlist is fully user-managed.
- All preferences live server-side on the profile so they follow the user across devices.

====================================================================
12. COMPLIANCE
====================================================================
- A fixed disclaimer in the site footer AND at the top of every AI-generated report:
  「本平台仅提供信息聚合与分析辅助，不构成投资建议，不执行交易、不代客理财。数据可能延迟或不完整，
  请自行核实来源后决策。」
- Every AI output visibly separates 事实 (with source link + timestamp) from 推演 (with confidence).
- Restate the non-goals list from the top of this document in the product's About/Help copy.

====================================================================
13. BUILD ORDER & ACCEPTANCE CHECKLIST
====================================================================
Phase 0 — Skeleton
  [ ] Auth (email + Google), profile with locale/timezone/base currency
  [ ] Design tokens, app shell, shared nav (one source of truth), footer disclaimer
  [ ] All tables created with GRANTs + RLS; cache table service-role only

Phase 1 — Accounts & Portfolio
  [ ] Create two accounts, switch between them
  [ ] Manual holding entry AND CSV import (template + mapping preview + row errors)
  [ ] Trading desk shows market value, cost, P&L, weights, sector and market breakdown
  [ ] Multi-currency converts to base currency with a dated FX rate

Phase 2 — Briefings & Index Board
  [ ] Index board renders 15 defaults with 5-day changes + AI attribution; user can add/remove
  [ ] Macro briefing renders all six cards in order, with fetch time + expandable source details
  [ ] Executive summary is 600–900 chars, opens by naming concrete markets, no filler
  [ ] Headlines: max 5, Chinese titles via AI translation, original-link fallback, multi-direction
      impact tags rendered
  [ ] Trading date is the latest S&P 500 session in ET; event times in the user's timezone + ET
  [ ] Manual refresh with a timezone/base-currency confirmation dialog
  [ ] Portfolio briefing demonstrably references the user's actual positions and sectors

Phase 3 — Research
  [ ] CRWV -> CoreWeave resolves; `700`/`0700` -> 0700.HK; `600519` -> 600519.SS; 招商银行 by name
  [ ] An invalid ticker errors out and produces NO report
  [ ] Fundamentals show revenue splits with explicit percentages + peer differentiation
  [ ] Earnings show date, actual revenue/net income, consensus, beat/miss in both amount and %,
      and D+1 / D+5 reaction
  [ ] Seasonality and flows render with the window explanation

Phase 4 — Discipline & Review
  [ ] Checklist template, pre-trade run, journal entry with rationale, stop-loss/position-cap warnings
  [ ] Event impact review: predicted vs. actual, D+1/D+5/D+20 returns, prediction hit rate
  [ ] Statistics: win rate, profit factor, expectancy, attribution by reason and sector,
      discipline-compliance rate

Phase 5 — Optional broker/exchange sync (moomoo, Bitget, Robinhood, IBKR, 富途)
  IMPORTANT CONSTRAINT: moomoo/futu OpenAPI requires a **local OpenD gateway process** and cannot be
  called from an edge/serverless backend, even with real account credentials. Do not promise cloud
  auto-sync for it. Offer instead: (a) a local desktop connector the user runs, which pushes holdings
  to the app over an authenticated endpoint, or (b) exchange read-only API keys (Bitget, and other
  venues that expose read-only REST) stored server-side and polled, or (c) read-only on-chain address
  tracking. CSV import remains the universal fallback.

====================================================================
14. EXECUTION RULES FOR THE BUILDING AGENT
====================================================================
- Create the schema before the pages that read it; create a route before you link to it.
- Every import must resolve — create the file or install the package before importing it.
- Never fabricate data to make a screen look full. Empty state > fake state.
- Validate every AI response against its schema; on validation failure, retry once, then render
  "数据暂不可用" rather than partial garbage.
- Keep server-only modules out of the client bundle; read environment variables inside handlers,
  not at module scope.
- Ship unit tests for the pure logic at minimum:
    * time formatting / trading-day anchoring / timezone + ET rendering
    * symbol normalization (US, HK 700/0700, CN 600519/000001, crypto, pass-through)
    * news impact scope (single item producing multiple opposite-direction targets)
    * executive summary generation (length bounds, no forbidden filler openers, market names present)
    * portfolio math (cost, market value, P&L, weights, FX conversion)
- Deliver a short README covering: required API keys and where to set them, cron setup for the daily
  briefing, and how caching/TTLs work.
- Finish with a summary of every judgment call you made where this spec was silent.
````
