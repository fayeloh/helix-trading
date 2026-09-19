/** 市场分组目录与用户关注偏好类型（纯数据，供纯函数与 UI 共用）。 */

export type MarketKey =
  | "us_equity"
  | "hk_cn_equity"
  | "jp_equity"
  | "precious_metals"
  | "energy"
  | "fx"
  | "bonds"
  | "crypto";

export type MarketGroup = {
  key: MarketKey;
  label: string;
  /** 命中该分组的标的名称关键词。 */
  keywords: string[];
};

export const MARKET_GROUPS: MarketGroup[] = [
  {
    key: "us_equity",
    label: "美股",
    keywords: ["S&P", "标普", "Nasdaq", "纳斯达克", "Dow", "道琼斯", "Russell", "罗素"],
  },
  {
    key: "hk_cn_equity",
    label: "港股与A股",
    keywords: ["恒生", "国企指数", "上证", "深证", "沪深", "科创", "A股"],
  },
  { key: "jp_equity", label: "日本股市", keywords: ["日经", "东证", "Nikkei"] },
  { key: "precious_metals", label: "贵金属", keywords: ["黄金", "白银", "铂", "Gold", "Silver"] },
  { key: "energy", label: "能源", keywords: ["原油", "WTI", "布伦特", "天然气", "Brent"] },
  { key: "fx", label: "外汇", keywords: ["DXY", "USD", "美元", "欧元", "日元", "人民币"] },
  { key: "bonds", label: "债券", keywords: ["国债", "收益率", "Treasury"] },
  { key: "crypto", label: "加密货币", keywords: ["比特币", "BTC", "以太", "ETH", "加密"] },
];

export const MARKET_LABEL: Record<MarketKey, string> = MARKET_GROUPS.reduce(
  (acc, g) => {
    acc[g.key] = g.label;
    return acc;
  },
  {} as Record<MarketKey, string>,
);

/** 名称 → 市场分组；无法归类时返回 undefined。 */
export function marketKeyOf(name: string): MarketKey | undefined {
  const lower = name.toLowerCase();
  for (const g of MARKET_GROUPS) {
    if (g.keywords.some((k) => lower.includes(k.toLowerCase()))) return g.key;
  }
  return undefined;
}

/** 设置里可勾选的常见板块。 */
export const SECTOR_OPTIONS = [
  "半导体",
  "科技",
  "云计算",
  "软件",
  "金融",
  "能源",
  "医疗保健",
  "消费",
  "工业",
  "航空",
  "运输",
  "房地产",
  "公用事业",
  "原材料",
  "新能源",
  "小盘股",
];

export type BriefingPrefs = {
  markets: MarketKey[];
  sectors: string[];
  /** 用户自由输入的关注关键词（市场 / 板块 / 标的均可）。 */
  keywords: string[];
};

export const EMPTY_PREFS: BriefingPrefs = { markets: [], sectors: [], keywords: [] };

export const KEYWORD_MAX_LEN = 24;
export const KEYWORD_MAX_COUNT = 20;

/** 清洗单个关键词：去首尾空白、压缩空格、限制长度；无效返回空串。 */
export function normalizeKeyword(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, KEYWORD_MAX_LEN);
}

/** 清洗关键词数组：去空、去重（大小写不敏感）、限制数量。 */
export function normalizeKeywords(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (typeof item !== "string") continue;
    const k = normalizeKeyword(item);
    if (!k) continue;
    const id = k.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(k);
    if (out.length >= KEYWORD_MAX_COUNT) break;
  }
  return out;
}

/** 文本是否命中任一自定义关键词（包含匹配，大小写不敏感）。 */
export function matchesKeywords(text: string, keywords?: string[]): boolean {
  if (!keywords?.length || !text) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => {
    const kk = k.toLowerCase();
    return kk.length > 0 && (lower.includes(kk) || kk.includes(lower));
  });
}

/** 弹窗搜索：过滤市场分组（匹配名称或关键词）。 */
export function filterMarketGroups(query: string): MarketGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return MARKET_GROUPS;
  return MARKET_GROUPS.filter(
    (g) => g.label.toLowerCase().includes(q) || g.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}

/** 弹窗搜索：过滤板块选项。 */
export function filterSectors(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return SECTOR_OPTIONS;
  return SECTOR_OPTIONS.filter((s) => s.toLowerCase().includes(q));
}

export function hasPrefs(prefs?: BriefingPrefs): boolean {
  return (
    !!prefs &&
    (prefs.markets.length > 0 || prefs.sectors.length > 0 || (prefs.keywords?.length ?? 0) > 0)
  );
}

