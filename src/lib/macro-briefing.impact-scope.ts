import { MARKET_GROUPS, MARKET_LABEL, type MarketKey } from "./macro-briefing.markets";
import type { HeadlineImpact, TopHeadline } from "./macro-briefing.types";

/** 影响对象的展示优先顺序：先市场，再板块。 */
export const MARKET_PRIORITY: MarketKey[] = [
  "us_equity",
  "hk_cn_equity",
  "crypto",
  "precious_metals",
  "energy",
  "fx",
  "bonds",
  "jp_equity",
];

export type ImpactScope = {
  markets: string[];
  sectors: string[];
  direction: HeadlineImpact;
  /** 同一条新闻中被利多的板块（仅在命中明确对立关系时非空）。 */
  bullish: string[];
  /** 同一条新闻中被利空的板块（仅在命中明确对立关系时非空）。 */
  bearish: string[];
};

/**
 * 常见对立关系：一条新闻同时利多某些板块、利空另一些板块。
 * 只在标题/理由明确点明因果时才拆分，命中不到则保持单一方向，不做猜测。
 */
const OPPOSING_RULES: { test: RegExp; bullish: string[]; bearish: string[] }[] = [
  {
    test: /(OPEC\+?\s*减产|减产)|((油价|原油|WTI|布伦特|天然气)[^。；]{0,12}(上涨|走高|大涨|飙升|跳涨|新高))/i,
    bullish: ["能源"],
    bearish: ["航空与运输", "消费"],
  },
  {
    test: /((油价|原油|WTI|布伦特)[^。；]{0,12}(下跌|下挫|重挫|暴跌|走低|跌破))/i,
    bullish: ["航空与运输", "消费"],
    bearish: ["能源"],
  },
  {
    test: /(加息|升息|((美债|国债|收益率)[^。；]{0,12}(上行|上升|上涨|走高|飙升))|((美元|美元指数|DXY)[^。；]{0,12}(走强|上涨|走高)))/i,
    bullish: ["金融"],
    bearish: ["科技与AI", "房地产", "贵金属"],
  },
  {
    test: /(降息|减息|((美债|国债|收益率)[^。；]{0,12}(下行|回落|下跌))|((美元|美元指数|DXY)[^。；]{0,12}(走弱|下跌|回落)))/i,
    bullish: ["科技与AI", "房地产", "贵金属"],
    bearish: ["金融"],
  },
  {
    test: /(关税|制裁|出口管制|禁令)/i,
    bullish: [],
    bearish: ["出口链", "消费"],
  },
  {
    test: /(国产替代|本土替代|自主可控|进口替代)/i,
    bullish: ["本土替代"],
    bearish: [],
  },
];

/** 解析对立关系：返回被利多 / 利空的板块（已去重、互斥）。 */
export function resolveOpposingSectors(text: string): { bullish: string[]; bearish: string[] } {
  const up: string[] = [];
  const down: string[] = [];
  for (const rule of OPPOSING_RULES) {
    if (!rule.test.test(text)) continue;
    for (const s of rule.bullish) if (!up.includes(s)) up.push(s);
    for (const s of rule.bearish) if (!down.includes(s)) down.push(s);
  }
  // 同时出现在两侧的板块方向不明确，直接剔除。
  const both = up.filter((s) => down.includes(s));
  return {
    bullish: up.filter((s) => !both.includes(s)),
    bearish: down.filter((s) => !both.includes(s)),
  };
}

const CRYPTO_TICKER = /^(BTC|ETH|SOL|XRP|DOGE|ADA|BNB)([-/](USD|USDT))?$/i;
const METAL_TICKER = /^(GC=F|SI=F|XAU|XAG|GLD|IAU|SLV)/i;
const ENERGY_TICKER = /^(CL=F|BZ=F|NG=F|XLE|USO)/i;
const HK_TICKER = /(^\d{4,5}\.HK$|\.HK$|^\^HSI)/i;
const CN_TICKER = /(\.(SS|SZ)$|^\^SSE)/i;
const US_TICKER = /^[A-Z]{1,5}$/;

function marketOfTicker(raw: string): MarketKey | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (CRYPTO_TICKER.test(t)) return "crypto";
  if (METAL_TICKER.test(t)) return "precious_metals";
  if (ENERGY_TICKER.test(t)) return "energy";
  if (HK_TICKER.test(t) || CN_TICKER.test(t)) return "hk_cn_equity";
  if (US_TICKER.test(t)) return "us_equity";
  return undefined;
}

function marketsOfText(text: string): MarketKey[] {
  const lower = text.toLowerCase();
  const hits: MarketKey[] = [];
  for (const g of MARKET_GROUPS) {
    if (g.keywords.some((k) => lower.includes(k.toLowerCase()))) hits.push(g.key);
  }
  return hits;
}

/**
 * 解析一条新闻的影响对象：市场按固定优先顺序排列，板块沿用新闻自带字段。
 * 无法归类时返回空数组，不做猜测。
 */
export function resolveImpactScope(h: {
  headline: string;
  reasoning?: string;
  impact: HeadlineImpact;
  affected_sectors?: string[];
  affected_tickers?: string[];
}): ImpactScope {
  const text = [h.headline, h.reasoning ?? "", ...(h.affected_sectors ?? [])].join(" ");
  const keys = new Set<MarketKey>(marketsOfText(text));
  for (const t of h.affected_tickers ?? []) {
    const key = marketOfTicker(t);
    if (key) keys.add(key);
  }

  const markets = MARKET_PRIORITY.filter((k) => keys.has(k)).map((k) => MARKET_LABEL[k]);
  const sectors: string[] = [];
  for (const s of h.affected_sectors ?? []) {
    const v = s.trim();
    // 与市场标签重复的板块名（如「加密货币」「贵金属」）不再重复列出。
    if (v && !sectors.includes(v) && !markets.includes(v)) sectors.push(v);
  }


  const opposing = resolveOpposingSectors(text);
  // 拆分出的板块从统一板块列表里去掉，避免同一个名字既在「板块」又在「利多/利空」出现。
  const split = new Set([...opposing.bullish, ...opposing.bearish]);
  const rest = sectors.filter((s) => !split.has(s));

  return {
    markets,
    sectors: split.size > 0 ? rest : sectors,
    direction: h.impact,
    bullish: opposing.bullish,
    bearish: opposing.bearish,
  };
}

/** 影响对象 → 中文短句；无法归类时给出保守文案。 */
export function formatImpactScope(scope: ImpactScope): string {
  const hasSplit = scope.bullish.length > 0 || scope.bearish.length > 0;
  if (hasSplit) {
    const parts: string[] = [];
    if (scope.markets.length) parts.push(`涉及市场：${scope.markets.join("、")}`);
    if (scope.bullish.length) parts.push(`利多：${scope.bullish.join("、")}`);
    if (scope.bearish.length) parts.push(`利空：${scope.bearish.join("、")}`);
    if (scope.sectors.length) parts.push(`其他相关板块：${scope.sectors.join("、")}`);
    return parts.join("｜");
  }
  const hasAny = scope.markets.length > 0 || scope.sectors.length > 0;
  if (scope.direction === "neutral") {
    return hasAny
      ? `方向暂不明确，需关注：${[...scope.markets, ...scope.sectors].join("、")}`
      : "方向暂不明确，影响范围未确认";
  }
  const word = scope.direction === "bullish" ? "利多" : "利空";
  if (!hasAny) return `${word}，但具体影响范围未确认`;
  const parts: string[] = [];
  if (scope.markets.length) parts.push(`${word}：${scope.markets.join("、")}`);
  if (scope.sectors.length) parts.push(`板块：${scope.sectors.join("、")}`);
  if (!scope.markets.length) return `${word}｜${parts.join("｜")}`;
  return parts.join("｜");
}

export function impactScopeText(h: TopHeadline): string {
  return formatImpactScope(resolveImpactScope(h));
}
