/**
 * 每日宏观简报数据契约。
 * 展示层只消费这些类型；后续接真实数据源时保持结构不变即可。
 */

export type IndexQuote = { name: string; change_pct: number };
export type FxQuote = { pair: string; value: number; change_pct: number };
export type CommodityQuote = { name: string; value: number; change_pct: number };
export type BondYield = { name: string; value: number; change_bp: number };

export type GlobalMarketOverview = {
  indices: IndexQuote[];
  vix: number;
  vix_change_pct: number;
  fx: FxQuote[];
  commodities: CommodityQuote[];
  bond_yields: BondYield[];
};

export type SectorMove = { sector: string; change_pct: number; reason: string };

export type MarketScope = "US" | "HK";

export type SectorRotation = {
  leading: SectorMove[];
  lagging: SectorMove[];
  /** 该组板块所属市场（美股 / 港股）。 */
  market?: MarketScope;
};

/** 按市场分组的板块轮动。 */
export type SectorRotationByMarket = Partial<Record<"us" | "hk", SectorRotation>>;


export type TrendSignal = {
  theme: string;
  signal: string;
  confidence: number;
  trigger: string;
};

export type Importance = "high" | "medium" | "low";

export type MacroCalendarEvent = {
  event: string;
  time: string;
  importance: Importance;
  /** 事件发生前的方向推演；只用于预期，不代表已发生事实。 */
  impact?: HeadlineImpact;
  affected_sectors?: string[];
  impact_reasoning?: string;
  is_forecast?: boolean;
  /** 事件详情/官方发布页链接（可选）。 */
  url?: string;
};

export type HeadlineImpact = "bullish" | "bearish" | "neutral";

export type TopHeadline = {
  headline: string;
  /** 英文原标题（标题经 AI 翻译成中文时保留）。 */
  headline_original?: string;
  source: string;
  time: string;
  impact: HeadlineImpact;
  affected_sectors: string[];
  affected_tickers: string[];
  reasoning: string;
  /** 新闻原文链接（可选）。 */
  url?: string;
};



export type MacroBriefing = {
  date: string;
  global_market_overview?: GlobalMarketOverview;
  sector_rotation?: SectorRotation;
  /** 板块轮动按市场分组（美股 / 港股），供卡片切换使用。 */
  sector_rotation_by_market?: SectorRotationByMarket;

  ai_trend_signals?: TrendSignal[];
  macro_calendar?: MacroCalendarEvent[];
  top_headlines?: TopHeadline[];
  /** 本次数据抓取完成时间（美国东部时间，格式 YYYY-MM-DD HH:mm）。 */
  fetched_at?: string;
  /** 仍为示例数据（未接入实时源）的模块，界面上需明确标注。 */
  demo_modules?: ModuleKey[];
  /** 各模块来源与更新时间明细。 */
  sources?: BriefingSources;
};


/** 数据来源明细：用于在每个模块卡片里展示抓取来源与更新时间。 */
export type DataSource = {
  /** 来源名称，例如「Yahoo Finance」。 */
  name: string;
  /** 该来源覆盖的字段，例如「股指 / VIX」。 */
  covers?: string;
  /** 来源侧的最新更新时间（美国东部时间，格式 YYYY-MM-DD HH:mm）。 */
  updated_at: string;
  url?: string;
};

export type ModuleKey =
  | "summary"
  | "global_market_overview"
  | "sector_rotation"
  | "ai_trend_signals"
  | "macro_calendar"
  | "top_headlines";

/** 各模块的来源明细。 */
export type BriefingSources = Partial<Record<ModuleKey, DataSource[]>>;
