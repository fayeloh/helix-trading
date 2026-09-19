export type MarketCode = "US" | "HK" | "CN" | "CRYPTO" | "OTHER";

export const MARKETS: { value: MarketCode; label: string; currency: string }[] = [
  { value: "US", label: "美股", currency: "USD" },
  { value: "HK", label: "港股", currency: "HKD" },
  { value: "CN", label: "A股", currency: "CNY" },
  { value: "CRYPTO", label: "加密货币", currency: "USD" },
  { value: "OTHER", label: "其他", currency: "USD" },
];

export const CURRENCIES = ["USD", "HKD", "CNY", "EUR", "JPY"] as const;

/** Base-currency conversion rates [默认方案，可调整]：MVP 使用静态汇率，Phase 2 接入日频汇率 API。 */
export const STATIC_FX_TO_USD: Record<string, number> = {
  USD: 1,
  HKD: 0.128,
  CNY: 0.138,
  EUR: 1.08,
  JPY: 0.0065,
};

export function convert(amount: number, from: string, to: string): number {
  const f = STATIC_FX_TO_USD[from] ?? 1;
  const t = STATIC_FX_TO_USD[to] ?? 1;
  return (amount * f) / t;
}

export type IndexGroup = "股指" | "加密" | "商品" | "宏观" | "个股";

export type IndexDef = {
  symbol: string;
  label: string;
  group: IndexGroup;
};

/** 全球指数看板默认标的 [默认方案，可调整] */
export const INDEX_BOARD: IndexDef[] = [
  { symbol: "^GSPC", label: "标普 500", group: "股指" },
  { symbol: "^IXIC", label: "纳斯达克", group: "股指" },
  { symbol: "^DJI", label: "道琼斯", group: "股指" },
  { symbol: "^RUT", label: "罗素 2000", group: "股指" },
  { symbol: "^HSI", label: "恒生指数", group: "股指" },
  { symbol: "^HSTECH", label: "恒生科技", group: "股指" },
  { symbol: "000300.SS", label: "沪深 300", group: "股指" },
  { symbol: "^N225", label: "日经 225", group: "股指" },
  { symbol: "^GDAXI", label: "德国 DAX", group: "股指" },
  { symbol: "BTC-USD", label: "比特币 BTC", group: "加密" },
  { symbol: "ETH-USD", label: "以太坊 ETH", group: "加密" },
  { symbol: "GC=F", label: "黄金 COMEX", group: "商品" },
  { symbol: "SI=F", label: "白银 COMEX", group: "商品" },
  { symbol: "CL=F", label: "WTI 原油", group: "商品" },
  { symbol: "DX-Y.NYB", label: "美元指数 DXY", group: "宏观" },
  { symbol: "^VIX", label: "VIX 波动率", group: "宏观" },
  { symbol: "^TNX", label: "美债 10Y", group: "宏观" },
];

/** 「编辑看板」中可一键添加的候选标的 */
export const INDEX_CATALOG: IndexDef[] = [
  ...INDEX_BOARD,
  { symbol: "^FTSE", label: "英国富时 100", group: "股指" },
  { symbol: "^FCHI", label: "法国 CAC 40", group: "股指" },
  { symbol: "^KS11", label: "韩国 KOSPI", group: "股指" },
  { symbol: "^TWII", label: "台湾加权", group: "股指" },
  { symbol: "^STOXX50E", label: "欧洲 STOXX 50", group: "股指" },
  { symbol: "000001.SS", label: "上证指数", group: "股指" },
  { symbol: "399001.SZ", label: "深证成指", group: "股指" },
  { symbol: "SOL-USD", label: "Solana SOL", group: "加密" },
  { symbol: "BNB-USD", label: "BNB", group: "加密" },
  { symbol: "XRP-USD", label: "XRP", group: "加密" },
  { symbol: "HG=F", label: "铜 COMEX", group: "商品" },
  { symbol: "NG=F", label: "天然气", group: "商品" },
  { symbol: "BZ=F", label: "布伦特原油", group: "商品" },
  { symbol: "^TYX", label: "美债 30Y", group: "宏观" },
  { symbol: "^FVX", label: "美债 5Y", group: "宏观" },
  { symbol: "USDCNY=X", label: "美元/人民币", group: "宏观" },
  { symbol: "USDJPY=X", label: "美元/日元", group: "宏观" },
];

export const INDEX_LABELS: Record<string, string> = Object.fromEntries(
  INDEX_CATALOG.map((i) => [i.symbol, i.label]),
);

export const RESEARCH_SECTIONS = [
  { key: "fundamentals", label: "公司基本面" },
  { key: "earnings", label: "财报分析" },
  { key: "cycle", label: "周期与季节性" },
  { key: "flows", label: "资金流向与聪明钱" },
] as const;

export type ResearchSection = (typeof RESEARCH_SECTIONS)[number]["key"];

export const LOOKBACK_OPTIONS = [30, 90, 180, 365];

export const DISCLAIMER =
  "本产品仅提供信息聚合与分析辅助，所有内容不构成投资建议、不构成买卖要约，且不执行任何交易。AI 生成内容可能存在错误或过时，请自行核实数据来源后独立决策。";
