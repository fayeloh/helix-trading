import { annotate, collectTerms, type GlossaryEntry } from "./macro-briefing.glossary";
import { formatImpactScope, resolveImpactScope } from "./macro-briefing.impact-scope";
import {
  MARKET_GROUPS,
  MARKET_LABEL,
  hasPrefs,
  marketKeyOf,
  matchesKeywords,
  type BriefingPrefs,
  type MarketKey,
} from "./macro-briefing.markets";
import type {
  GlobalMarketOverview,
  MacroBriefing,
  TopHeadline,
} from "./macro-briefing.types";

/* ------------------------------------------------------------------ */
/* 格式化                                                              */
/* ------------------------------------------------------------------ */

const fmtPct = (v: number) =>
  `${v > 0 ? "上涨" : v < 0 ? "下跌" : "持平"}${Math.abs(v).toFixed(2)}%`;
const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
/** 报价数字：汇率保留 4 位，其余 2 位，避免浮点长尾。 */
const fmtValue = (v: number, digits = 2) => v.toFixed(digits);

/* ------------------------------------------------------------------ */
/* 重要性打分                                                          */
/* ------------------------------------------------------------------ */

/** 候选句子的类目，同分时作为兜底排序依据。 */
export const CATEGORY_ORDER = [
  "index",
  "vix",
  "fx",
  "commodity",
  "bond",
  "sector",
  "calendar",
  "headline",
] as const;

export type Category = (typeof CATEGORY_ORDER)[number];

export type ScorableItem =
  | { kind: "index"; name: string; change_pct: number }
  | { kind: "vix"; change_pct: number }
  | { kind: "fx"; pair: string; change_pct: number }
  | { kind: "commodity"; name: string; change_pct: number }
  | { kind: "bond"; name: string; change_bp: number }
  | { kind: "sector"; change_pct: number }
  | { kind: "calendar"; importance: string; hoursAhead: number }
  | {
      kind: "headline";
      importance?: string;
      impact?: string;
      breadth: number;
    };

const INDEX_WEIGHTS: Record<string, number> = {
  "S&P 500": 1,
  Nasdaq: 1,
  "Dow Jones": 1,
  道琼斯: 1,
  纳斯达克: 1,
  恒生指数: 0.6,
  恒生科技: 0.6,
  日经225: 0.6,
  上证指数: 0.6,
  "Russell 2000": 0.4,
  罗素2000: 0.4,
};

const FX_WEIGHTS: Record<string, number> = { DXY: 1, "USD/CNY": 0.8 };
const COMMODITY_WEIGHTS: Record<string, number> = { WTI原油: 0.8, 原油: 0.8, 黄金: 0.6 };

const IMPORTANCE_WEIGHTS: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function indexWeight(name: string): number {
  return INDEX_WEIGHTS[name] ?? 0.6;
}

/** 统一重要性打分：分数越高越应该出现在摘要靠前的位置。 */
export function scoreMateriality(item: ScorableItem): number {
  switch (item.kind) {
    case "index":
      return Math.abs(item.change_pct) * indexWeight(item.name);
    case "vix":
      return Math.abs(item.change_pct) * 1.5;
    case "fx":
      return Math.abs(item.change_pct) * (FX_WEIGHTS[item.pair] ?? 0.6);
    case "commodity":
      return Math.abs(item.change_pct) * (COMMODITY_WEIGHTS[item.name] ?? 0.6);
    case "bond":
      return (Math.abs(item.change_bp) / 10) * 1.2;
    case "sector":
      return Math.abs(item.change_pct) * 0.8;
    case "calendar":
      // 仅未来 48 小时内的事件计入。
      if (item.hoursAhead < 0 || item.hoursAhead > 48) return 0;
      return IMPORTANCE_WEIGHTS[item.importance] ?? 1;
    case "headline": {
      const base = IMPORTANCE_WEIGHTS[item.importance ?? ""] ?? (item.impact === "neutral" ? 1 : 2);
      return base * (1 + item.breadth * 0.15);
    }
    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ */
/* 情绪判定                                                            */
/* ------------------------------------------------------------------ */

export type MarketRegime = { label: string; detail: string; score: number };

const VIX_REGIME_WEIGHT = 0.5;

function regimeLabel(score: number): string {
  if (score > 1) return "明显偏暖";
  if (score > 0.25) return "温和偏暖";
  if (score >= -0.25) return "中性";
  if (score >= -1) return "温和谨慎";
  return "明显谨慎";
}

/**
 * 加权综合分判定当日市场氛围。
 * regime_score = Σ(指数涨跌幅 × 指数权重) − VIX涨跌幅 × VIX权重
 * 指数与 VIX 方向冲突时输出复合判断句，而非单一标签。
 */
export function composeMarketRegime(overview?: GlobalMarketOverview): MarketRegime {
  const indices = overview?.indices ?? [];
  if (!indices.length && typeof overview?.vix !== "number") {
    return { label: "数据不足", detail: "当日市场数据暂不可用。", score: 0 };
  }

  const equity = indices.reduce((sum, i) => sum + i.change_pct * indexWeight(i.name), 0);
  const vixChange = typeof overview?.vix_change_pct === "number" ? overview.vix_change_pct : 0;
  const score = equity - vixChange * VIX_REGIME_WEIGHT;

  const equityDir = equity > 0.15 ? 1 : equity < -0.15 ? -1 : 0;
  const vixDir = vixChange > 0.5 ? 1 : vixChange < -0.5 ? -1 : 0;
  const conflict = equityDir !== 0 && vixDir !== 0 && equityDir === vixDir;

  if (conflict) {
    const detail =
      equityDir > 0
        ? `指数${equity > 1 ? "明显" : "温和"}上涨，但 VIX 同步走高，反映市场情绪仍偏谨慎。`
        : `指数${equity < -1 ? "明显" : "温和"}下跌，但 VIX 同步回落，说明抛压更像是获利了结而非恐慌。`;
    return { label: "信号分歧", detail, score };
  }

  const label = regimeLabel(score);
  const detail =
    label === "中性"
      ? "多空力量接近均衡，缺少明确方向。"
      : label.includes("偏暖")
        ? "愿意承担风险的资金更活跃。"
        : "资金更倾向防守。";
  return { label, detail, score };
}

/* ------------------------------------------------------------------ */
/* 头条挑选                                                            */
/* ------------------------------------------------------------------ */

/** 按重要性与影响广度挑出最值得关注的一条头条；无候选时返回 undefined。 */
export function selectTopHeadline(headlines?: TopHeadline[]): TopHeadline | undefined {
  if (!headlines?.length) return undefined;
  const scored = headlines.map((h, idx) => ({
    h,
    idx,
    s: scoreMateriality({
      kind: "headline",
      impact: h.impact,
      breadth: (h.affected_sectors?.length ?? 0) + (h.affected_tickers?.length ?? 0),
    }),
  }));
  scored.sort((a, b) => b.s - a.s || a.idx - b.idx);
  return scored[0]!.h;
}

/* ------------------------------------------------------------------ */
/* 句子装配                                                            */
/* ------------------------------------------------------------------ */

export type ScoredSentence = { text: string; score: number; category: Category };

const DISCLAIMER = "以上内容用于辅助判断，不构成任何投资建议，也不代表买卖操作指令。";
export const HARD_MAX = 900;
export const SOFT_MAX = 600;

/**
 * 按重要性从高到低装配段落；超过硬上限时优先丢弃分数最低的整句。
 * 没有字数下限——信息量小的一天输出就应该短。
 */
export function assembleParagraph(
  scoredItems: ScoredSentence[],
  regime: MarketRegime,
  topHeadline: TopHeadline | undefined,
  maxLength = HARD_MAX,
  options: { softMax?: number; headlineCount?: number } = {},
): string {
  const softMax = Math.min(options.softMax ?? SOFT_MAX, maxLength);
  const budget = maxLength - DISCLAIMER.length;

  const lead = regime.label === "数据不足" ? regime.detail : `当日市场氛围${regime.label}，${regime.detail}`;

  const catRank = (c: Category) => CATEGORY_ORDER.indexOf(c);
  const sorted = [...scoredItems]
    .map((s, idx) => ({ ...s, idx }))
    .sort((a, b) => b.score - a.score || catRank(a.category) - catRank(b.category) || a.idx - b.idx);

  const kept: typeof sorted = [];
  let len = lead.length;
  for (const s of sorted) {
    if (len >= softMax) break;
    if (len + s.text.length > budget) continue;
    kept.push(s);
    len += s.text.length;
  }

  // 硬上限兜底：按分数从低到高移除整句。
  while (len > budget && kept.length) {
    let worst = 0;
    for (let i = 1; i < kept.length; i++) {
      const a = kept[i]!;
      const b = kept[worst]!;
      if (a.score < b.score || (a.score === b.score && catRank(a.category) > catRank(b.category))) {
        worst = i;
      }
    }
    len -= kept[worst]!.text.length;
    kept.splice(worst, 1);
  }

  // 恢复叙述顺序：仍按重要性输出（分数降序），保证最重要的先读到。
  let body = lead + kept.map((k) => k.text).join("");

  // 头条只做引导式提及，完整展开交给「头条新闻与影响分析」卡片。
  if (topHeadline) {
    const count = options.headlineCount ?? 1;
    const mention = `今天有 ${count} 条值得关注的新闻，其中最值得关注的是「${topHeadline.headline}」，完整的影响板块与标的判断见下方头条新闻模块。`;
    if (body.length + mention.length + DISCLAIMER.length <= maxLength) body += mention;
  }

  return body + DISCLAIMER;
}

/* ------------------------------------------------------------------ */
/* 候选句子生成                                                        */
/* ------------------------------------------------------------------ */

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

function parseTime(s: string): Date | null {
  const d = new Date(s.replace(" ", "T") + (/\d{2}:\d{2}/.test(s) ? ":00Z" : "T00:00:00Z"));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildCandidates(data: MacroBriefing, now?: Date): ScoredSentence[] {
  const out: ScoredSentence[] = [];
  const o = data.global_market_overview;

  if (o?.indices?.length) {
    const sorted = [...o.indices].sort((a, b) => b.change_pct - a.change_pct);
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
    const upCount = o.indices.filter((i) => i.change_pct > 0).length;
    out.push({
      category: "index",
      score: Math.max(
        scoreMateriality({ kind: "index", name: best.name, change_pct: best.change_pct }),
        scoreMateriality({ kind: "index", name: worst.name, change_pct: worst.change_pct }),
      ),
      text: `跟踪的 ${o.indices.length} 个主要股指中有 ${upCount} 个收涨，表现最好的是${best.name}，${fmtPct(best.change_pct)}${
        best.name === worst.name ? "" : `，最弱的是${worst.name}，${fmtPct(worst.change_pct)}`
      }。`,
    });
  }

  if (o && typeof o.vix === "number") {
    const ch = o.vix_change_pct ?? 0;
    out.push({
      category: "vix",
      score: scoreMateriality({ kind: "vix", change_pct: ch }),
      text: `VIX 报 ${o.vix.toFixed(2)}，当天${fmtPct(ch)}，${ch <= 0 ? "市场对剧烈波动的定价在下降，对风险资产偏有利。" : "市场愿意为尾部风险多付保险费，对风险资产偏不利。"}`,
    });
  }

  for (const f of o?.fx ?? []) {
    out.push({
      category: "fx",
      score: scoreMateriality({ kind: "fx", pair: f.pair, change_pct: f.change_pct }),
      text: `${f.pair} 报 ${fmtValue(f.value, 4)}，${signed(f.change_pct)}。`,
    });
  }

  for (const c of o?.commodities ?? []) {
    out.push({
      category: "commodity",
      score: scoreMateriality({ kind: "commodity", name: c.name, change_pct: c.change_pct }),
      text: `${c.name} 报 ${fmtValue(c.value)}，${signed(c.change_pct)}。`,
    });
  }

  for (const b of o?.bond_yields ?? []) {
    out.push({
      category: "bond",
      score: scoreMateriality({ kind: "bond", name: b.name, change_bp: b.change_bp }),
      text: `${b.name}收益率报 ${b.value.toFixed(2)}%，当天变动 ${b.change_bp > 0 ? "+" : ""}${b.change_bp}bp，${b.change_bp <= 0 ? "给高估值成长股留出更多空间。" : "会先压制靠远期利润支撑的公司。"}`,
    });
  }

  const lead = data.sector_rotation?.leading?.[0];
  const lag = data.sector_rotation?.lagging?.[0];
  if (lead || lag) {
    const mkt = data.sector_rotation?.market === "HK" ? "港股" : "美股";
    out.push({
      category: "sector",
      score: Math.max(
        lead ? scoreMateriality({ kind: "sector", change_pct: lead.change_pct }) : 0,
        lag ? scoreMateriality({ kind: "sector", change_pct: lag.change_pct }) : 0,
      ),
      text: `${mkt}板块轮动上，${lead ? `${lead.sector}领涨 ${signed(lead.change_pct)}，原因是${lead.reason}` : "领涨方向不明显"}；${lag ? `${lag.sector}领跌 ${signed(lag.change_pct)}，主要受${lag.reason}影响` : "领跌方向不明显"}。`,
    });
  }


  const base = now ?? parseTime(data.date) ?? new Date();
  const upcoming = (data.macro_calendar ?? [])
    .map((e) => {
      const t = parseTime(e.time);
      return { e, hours: t ? hoursBetween(base, t) : -1 };
    })
    .filter((x) => x.hours >= -12 && x.hours <= 48);

  if (upcoming.length) {
    const ranked = [...upcoming].sort(
      (a, b) =>
        scoreMateriality({ kind: "calendar", importance: b.e.importance, hoursAhead: Math.max(b.hours, 0) }) -
        scoreMateriality({ kind: "calendar", importance: a.e.importance, hoursAhead: Math.max(a.hours, 0) }),
    );
    const top = ranked.slice(0, 3);
    out.push({
      category: "calendar",
      score: scoreMateriality({
        kind: "calendar",
        importance: top[0]!.e.importance,
        hoursAhead: Math.max(top[0]!.hours, 0),
      }),
      text: `未来 48 小时内要盯的时间点是${top.map((x) => `${x.e.event}（${x.e.time.slice(5)}）`).join("、")}。`,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* 对外产出                                                            */
/* ------------------------------------------------------------------ */

/** 摘要卡片：≤120 字，3-4 条要点。 */
export function buildBriefSummary(data: MacroBriefing, now?: Date): string[] {
  const regime = composeMarketRegime(data.global_market_overview);
  const items = buildCandidates(data, now);
  const bullets: string[] = [
    regime.label === "数据不足" ? regime.detail : `市场氛围${regime.label}：${regime.detail}`,
  ];

  const catRank = (c: Category) => CATEGORY_ORDER.indexOf(c);
  const ranked = [...items]
    .filter((i) => i.category !== "index")
    .sort((a, b) => b.score - a.score || catRank(a.category) - catRank(b.category));

  const head = selectTopHeadline(data.top_headlines);
  const reserve = head ? 1 : 0;

  for (const r of ranked) {
    if (bullets.length >= 4 - reserve) break;
    const short = r.text.length > 40 ? r.text.slice(0, 39) + "…" : r.text;
    if (bullets.join("").length + short.length > 120) continue;
    bullets.push(short);
  }

  if (head && bullets.join("").length + head.headline.length + 12 <= 120) {
    bullets.push(`焦点新闻：${head.headline}`);
  }
  return bullets;
}

/* ------------------------------------------------------------------ */
/* 市场分组                                                            */
/* ------------------------------------------------------------------ */

export type MarketVerdict = {
  key: MarketKey;
  label: string;
  /** 该分组的平均涨跌幅（债券为 bp/100 折算，仅用于方向判断）。 */
  change: number;
  /** 回暖 / 微涨 / 基本持平 / 微跌 / 走弱 */
  verdict: string;
  /** 明细，例如「纳斯达克 +0.7%」。 */
  details: string[];
};

function verdictOf(change: number): string {
  if (change >= 0.3) return "回暖";
  if (change > 0.05) return "微涨";
  if (change <= -0.3) return "走弱";
  if (change < -0.05) return "微跌";
  return "基本持平";
}

/** 把概览数据按市场归类，输出「哪个市场在回暖/走弱」的判断。 */
export function groupMarkets(overview?: GlobalMarketOverview): MarketVerdict[] {
  const buckets = new Map<MarketKey, { sum: number; n: number; details: string[] }>();

  const add = (name: string, change: number, detail: string) => {
    const key = marketKeyOf(name);
    if (!key) return;
    const b = buckets.get(key) ?? { sum: 0, n: 0, details: [] };
    b.sum += change;
    b.n += 1;
    b.details.push(detail);
    buckets.set(key, b);
  };

  for (const i of overview?.indices ?? []) {
    add(i.name, i.change_pct, `${i.name} ${signed(i.change_pct)}`);
  }
  for (const c of overview?.commodities ?? []) {
    add(c.name, c.change_pct, `${c.name} ${signed(c.change_pct)}`);
  }
  for (const f of overview?.fx ?? []) {
    add(f.pair, f.change_pct, `${f.pair} ${signed(f.change_pct)}`);
  }
  for (const b of overview?.bond_yields ?? []) {
    add(
      b.name,
      b.change_bp / 100,
      `${b.name}收益率 ${b.value.toFixed(2)}%（${b.change_bp > 0 ? "+" : ""}${b.change_bp}bp）`,
    );
  }

  const out: MarketVerdict[] = [];
  for (const g of MARKET_GROUPS) {
    const b = buckets.get(g.key);
    if (!b || b.n === 0) continue;
    const change = b.sum / b.n;
    out.push({ key: g.key, label: g.label, change, verdict: verdictOf(change), details: b.details });
  }
  return out;
}

/** 开头的市场分组句：明确点名哪个市场回暖、哪个走弱。 */
export function composeMarketLead(overview?: GlobalMarketOverview): string {
  const groups = groupMarkets(overview);
  if (!groups.length) return "";
  const parts = groups.map((g) => {
    const suffix =
      g.key === "bonds"
        ? g.change > 0
          ? "（借钱成本上升，会压制高估值股票）"
          : "（借钱成本下降，对高估值股票偏有利）"
        : "";
    return `${g.label}${g.verdict}（${g.details.join("、")}）${suffix}`;
  });
  return `分市场看：${parts.join("；")}。`;
}

/* ------------------------------------------------------------------ */
/* 关注偏好                                                            */
/* ------------------------------------------------------------------ */

const FOCUS_BOOST = 1.8;

function matchesPrefs(text: string, prefs?: BriefingPrefs): boolean {
  if (!hasPrefs(prefs)) return false;
  for (const key of prefs!.markets) {
    const group = MARKET_GROUPS.find((g) => g.key === key);
    if (group?.keywords.some((k) => text.toLowerCase().includes(k.toLowerCase()))) return true;
  }
  if (prefs!.sectors.some((s) => text.includes(s))) return true;
  return matchesKeywords(text, prefs!.keywords);
}

/** 按关注偏好给候选句加权（不改变句子内容，只改变优先级）。 */
export function applyPrefsWeighting(
  items: ScoredSentence[],
  prefs?: BriefingPrefs,
): ScoredSentence[] {
  if (!hasPrefs(prefs)) return items;
  return items.map((i) =>
    matchesPrefs(i.text, prefs) ? { ...i, score: i.score * FOCUS_BOOST } : i,
  );
}

/** 关键词命中的行情条目（指数 / 商品 / 汇率 / 债券）。 */
function keywordQuoteHits(
  overview: GlobalMarketOverview | undefined,
  keywords?: string[],
): string[] {
  if (!keywords?.length || !overview) return [];
  const out: string[] = [];
  for (const i of overview.indices ?? []) {
    if (matchesKeywords(i.name, keywords)) out.push(`${i.name} ${signed(i.change_pct)}`);
  }
  for (const c of overview.commodities ?? []) {
    if (matchesKeywords(c.name, keywords)) out.push(`${c.name} ${signed(c.change_pct)}`);
  }
  for (const f of overview.fx ?? []) {
    if (matchesKeywords(f.pair, keywords)) out.push(`${f.pair} ${signed(f.change_pct)}`);
  }
  for (const b of overview.bond_yields ?? []) {
    if (matchesKeywords(b.name, keywords)) {
      out.push(`${b.name}收益率 ${b.value.toFixed(2)}%（${b.change_bp > 0 ? "+" : ""}${b.change_bp}bp）`);
    }
  }
  return out;
}

/** 开头的关注归纳句；没有设置偏好时返回空串。 */
export function buildFocusLead(data: MacroBriefing, prefs?: BriefingPrefs): string {
  if (!hasPrefs(prefs)) return "";
  const keywords = prefs!.keywords ?? [];
  const groups = groupMarkets(data.global_market_overview);
  const picked = groups.filter((g) => prefs!.markets.includes(g.key));

  const sectorMoves = [
    ...(data.sector_rotation?.leading ?? []),
    ...(data.sector_rotation?.lagging ?? []),
  ].filter(
    (s) =>
      prefs!.sectors.some((p) => s.sector.includes(p) || p.includes(s.sector)) ||
      matchesKeywords(s.sector, keywords),
  );

  const segs: string[] = [];
  for (const g of picked) segs.push(`${g.label}${g.verdict}（${g.details.join("、")}）`);
  for (const s of sectorMoves) segs.push(`${s.sector} ${signed(s.change_pct)}`);
  for (const q of keywordQuoteHits(data.global_market_overview, keywords)) segs.push(q);

  // 关键词命中的新闻也作为一条归纳。
  const newsHits = (data.top_headlines ?? []).filter((h) =>
    matchesKeywords(
      [h.headline, ...(h.affected_sectors ?? []), ...(h.affected_tickers ?? [])].join(" "),
      keywords,
    ),
  );
  for (const h of newsHits.slice(0, 2)) segs.push(`相关新闻「${h.headline}」`);

  if (!segs.length) {
    const names = [
      ...prefs!.markets.map((m) => MARKET_LABEL[m]),
      ...prefs!.sectors,
      ...keywords,
    ].join("、");
    return names ? `你关注的${names}今天没有可用数据。` : "";
  }
  return `你关注的部分：${dedupe(segs).join("；")}。`;
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}

/* ------------------------------------------------------------------ */
/* 值得关注的新闻                                                      */
/* ------------------------------------------------------------------ */

export type HeadlineNote = {
  headline: string;
  /** 一句话解读。 */
  note: string;
  /** 预测：利多 / 利空 / 中性。 */
  impact: TopHeadline["impact"];
  source: string;
  time: string;
  url?: string;
  /** 是否命中用户关注的市场/板块。 */
  focused: boolean;
  /** 影响对象：先市场，再板块。 */
  scope: string;
};

/** 每条新闻附一句解读与利多/利空/中性判断；命中关注偏好的排前面。 */
export function buildHeadlineNotes(
  headlines?: TopHeadline[],
  limit = 5,
  prefs?: BriefingPrefs,
): HeadlineNote[] {
  if (!headlines?.length) return [];
  const scored = headlines.map((h, idx) => {
    const searchText = [h.headline, ...(h.affected_sectors ?? []), ...(h.affected_tickers ?? [])].join(
      " ",
    );
    const focused = matchesPrefs(searchText, prefs);
    const base = scoreMateriality({
      kind: "headline",
      impact: h.impact,
      breadth: (h.affected_sectors?.length ?? 0) + (h.affected_tickers?.length ?? 0),
    });
    return { h, idx, focused, score: focused ? base * FOCUS_BOOST : base };
  });

  // 命中关注偏好的新闻优先，其次按重要性。
  scored.sort(
    (a, b) => Number(b.focused) - Number(a.focused) || b.score - a.score || a.idx - b.idx,
  );

  return scored.slice(0, limit).map(({ h, focused }) => {
    const sectors = (h.affected_sectors ?? []).slice(0, 3).join("、");
    const reason = h.reasoning?.trim() || "暂无更多细节";
    const note = sectors ? `${reason}，主要影响${sectors}。` : `${reason}。`;
    const item: HeadlineNote = {
      headline: h.headline,
      note,
      scope: formatImpactScope(resolveImpactScope(h)),
      impact: h.impact,
      source: h.source,
      time: h.time,
      focused,
    };
    if (h.url) item.url = h.url;
    return item;
  });
}

/* ------------------------------------------------------------------ */
/* 详细解读 / 执行摘要                                                 */
/* ------------------------------------------------------------------ */

export type ExecutiveSummaryResult = {
  /** 主段落（含关注归纳、分市场判断与核心数据），术语已内联加注。 */
  paragraph: string;
  /** 值得关注的新闻清单（含解读与利多/利空/中性）。 */
  headlines: HeadlineNote[];
  /** 段末术语表。 */
  terms: GlossaryEntry[];
  /** 免责声明，UI 单独展示。 */
  disclaimer: string;
};

/** 详细解读：内容驱动长度，软上限 600 字、硬上限 900 字，无下限。 */
export function buildExecutiveParagraph(
  data: MacroBriefing,
  now?: Date,
  prefs?: BriefingPrefs,
): string {
  const regime = composeMarketRegime(data.global_market_overview);
  const items = applyPrefsWeighting(buildCandidates(data, now), prefs);
  const options: { softMax: number } = { softMax: SOFT_MAX };
  const body = assembleParagraph(items, regime, undefined, HARD_MAX, options);
  const focus = buildFocusLead(data, prefs);
  const marketLead = composeMarketLead(data.global_market_overview);
  return focus + marketLead + body;
}

/** 执行摘要的结构化产出：段落 + 新闻解读清单 + 术语表。 */
export function buildExecutiveSummary(
  data: MacroBriefing,
  now?: Date,
  prefs?: BriefingPrefs,
): ExecutiveSummaryResult {
  const raw = buildExecutiveParagraph(data, now, prefs);
  const withoutDisclaimer = raw.endsWith(DISCLAIMER)
    ? raw.slice(0, raw.length - DISCLAIMER.length)
    : raw;
  const paragraph = annotate(withoutDisclaimer);
  const headlines = buildHeadlineNotes(data.top_headlines, 5, prefs);
  const termSource = [withoutDisclaimer, ...headlines.map((h) => `${h.headline}${h.note}`)].join("");
  return {
    paragraph,
    headlines,
    terms: collectTerms(termSource),
    disclaimer: DISCLAIMER,
  };
}

