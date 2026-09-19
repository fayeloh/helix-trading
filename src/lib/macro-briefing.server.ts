import type {
  BondYield,
  CommodityQuote,
  FxQuote,
  GlobalMarketOverview,
  IndexQuote,
  SectorMove,
  SectorRotation,
  TrendSignal,
} from "./macro-briefing.types";
import { etStamp } from "./macro-briefing.news.server";
import { fetchSeries, readCache, writeCache } from "./market.server";


type Snap = {
  /** 最新收盘价（或最新价）。 */
  value: number;
  /** 相对上一交易日收盘的涨跌幅（%）。 */
  changePct: number;
  /** 最新交易日日期，YYYY-MM-DD。 */
  date: string;
};

/** 取单个标的的「最新交易日 vs 前一交易日」快照；失败返回 null，不猜数。 */
async function snap(symbol: string): Promise<Snap | null> {
  const key = `macro_snap_${symbol}`;
  const cached = await readCache<Snap>(key);
  if (cached) return cached;
  // 行情源偶发限流（429）/超时，重试一次再放弃，避免整块数据变成「暂不可用」。
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const series = await fetchSeries(symbol, "1mo", "1d");
      const candles = series.candles;
      const last = candles.at(-1);
      const prev = candles.at(-2);
      if (last && prev && prev.c) {
        const value: Snap = {
          value: last.c,
          changePct: ((last.c - prev.c) / prev.c) * 100,
          date: new Date(last.t).toISOString().slice(0, 10),
        };
        await writeCache(key, value, 900);
        return value;
      }
    } catch {
      /* 继续重试 */
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}


/** 限制并发，避免行情源触发限流（429）导致整批为空。 */
async function snapAll(symbols: string[], concurrency = 3): Promise<(Snap | null)[]> {
  const out: (Snap | null)[] = new Array(symbols.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, async () => {
    while (cursor < symbols.length) {
      const i = cursor++;
      out[i] = await snap(symbols[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}


const INDEX_DEFS: { symbol: string; name: string }[] = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "Nasdaq" },
  { symbol: "^DJI", name: "道琼斯" },
  { symbol: "^HSI", name: "恒生指数" },
  { symbol: "^N225", name: "日经225" },
];

const FX_DEFS: { symbol: string; pair: string }[] = [
  { symbol: "USDCNY=X", pair: "USD/CNY" },
  { symbol: "DX-Y.NYB", pair: "DXY" },
];

const COMMODITY_DEFS: { symbol: string; name: string }[] = [
  { symbol: "CL=F", name: "WTI原油" },
  { symbol: "GC=F", name: "黄金" },
];

const BOND_DEFS: { symbol: string; name: string }[] = [
  { symbol: "^TNX", name: "美10年期国债" },
  { symbol: "^FVX", name: "美5年期国债" },
];

/** 美股板块轮动用的行业 ETF（Yahoo Finance 免费行情）。 */
const SECTOR_DEFS_US: { symbol: string; name: string }[] = [
  { symbol: "SOXX", name: "半导体" },
  { symbol: "XLK", name: "科技" },
  { symbol: "XLF", name: "金融" },
  { symbol: "XLE", name: "能源" },
  { symbol: "XLV", name: "医疗保健" },
  { symbol: "XLI", name: "工业" },
  { symbol: "XLY", name: "可选消费" },
  { symbol: "XLP", name: "日常消费" },
  { symbol: "XLU", name: "公用事业" },
  { symbol: "XLRE", name: "房地产" },
];

/** 港股板块轮动：恒生行业分类指数 + 恒生科技 ETF（Yahoo Finance 免费行情）。 */
const SECTOR_DEFS_HK: { symbol: string; name: string }[] = [
  { symbol: "3033.HK", name: "恒生科技" },
  { symbol: "^HSNF", name: "金融" },
  { symbol: "^HSNP", name: "地产建筑" },
  { symbol: "^HSNU", name: "公用事业" },
  { symbol: "^HSNC", name: "工商业" },
  { symbol: "^HSCE", name: "中资股（国企指数）" },
];

export type MacroMarketData = {
  /** 最新交易日（美东日期，以标普 500 为基准）。 */
  date: string;
  fetched_at: string;
  global_market_overview: GlobalMarketOverview | null;
  sector_rotation: SectorRotation | null;
  sector_rotation_hk: SectorRotation | null;
  trend_signals: TrendSignal[];
};


function moveOf(name: string, symbol: string, changePct: number): SectorMove {
  return {
    sector: name,
    change_pct: Number(changePct.toFixed(2)),
    reason: `行业标的 ${symbol} 当日${changePct >= 0 ? "上涨" : "下跌"} ${Math.abs(changePct).toFixed(2)}%（当日具体驱动未经确认）`,
  };
}

function rotationOf(
  defs: { symbol: string; name: string }[],
  snaps: (Snap | null)[],
  market: "US" | "HK",
): SectorRotation | null {
  const moves: SectorMove[] = [];
  defs.forEach((d, i) => {
    const s = snaps[i];
    if (s) moves.push(moveOf(d.name, d.symbol, s.changePct));
  });
  moves.sort((a, b) => b.change_pct - a.change_pct);
  if (moves.length < 2) return null;
  return { leading: moves.slice(0, 3), lagging: moves.slice(-3).reverse(), market };
}

/** 由真实行情推演的趋势信号：只描述已发生的数据，不预测点位。 */
function buildTrendSignals(
  overview: GlobalMarketOverview | null,
  us: SectorRotation | null,
  hk: SectorRotation | null,
): TrendSignal[] {
  if (!overview) return [];
  const out: TrendSignal[] = [];
  const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  const us500 = overview.indices.find((i) => i.name === "S&P 500");
  if (us500 && overview.vix) {
    const riskOn = us500.change_pct >= 0 && overview.vix_change_pct <= 0;
    const riskOff = us500.change_pct < 0 && overview.vix_change_pct > 0;
    out.push({
      theme: "美股风险偏好",
      signal: riskOn ? "回升" : riskOff ? "转弱" : "分歧",
      confidence: riskOn || riskOff ? 0.68 : 0.45,
      trigger: `标普500 ${pct(us500.change_pct)}，VIX（恐慌指数）${pct(overview.vix_change_pct)} 至 ${overview.vix.toFixed(2)}`,
    });
  }

  const hsi = overview.indices.find((i) => i.name === "恒生指数");
  const hkTech = hk?.leading.concat(hk.lagging ?? []).find((s) => s.sector === "恒生科技");
  if (hsi) {
    out.push({
      theme: "港股方向",
      signal: hsi.change_pct >= 0.3 ? "偏强" : hsi.change_pct <= -0.3 ? "偏弱" : "震荡",
      confidence: Math.abs(hsi.change_pct) >= 0.8 ? 0.66 : 0.48,
      trigger: `恒生指数 ${pct(hsi.change_pct)}${hkTech ? `，恒生科技 ${pct(hkTech.change_pct)}` : ""}`,
    });
  }

  const dxy = overview.fx.find((f) => f.pair === "DXY");
  if (dxy) {
    out.push({
      theme: "美元走势",
      signal: dxy.change_pct >= 0.15 ? "转强" : dxy.change_pct <= -0.15 ? "转弱" : "持稳",
      confidence: Math.abs(dxy.change_pct) >= 0.4 ? 0.62 : 0.45,
      trigger: `美元指数（DXY）${pct(dxy.change_pct)} 至 ${dxy.value.toFixed(2)}`,
    });
  }

  const bond = overview.bond_yields[0];
  if (bond) {
    out.push({
      theme: "利率环境",
      signal: bond.change_bp <= -3 ? "宽松交易" : bond.change_bp >= 3 ? "利率压制" : "中性",
      confidence: Math.abs(bond.change_bp) >= 6 ? 0.64 : 0.46,
      trigger: `${bond.name}收益率 ${bond.value.toFixed(2)}%，当日 ${bond.change_bp > 0 ? "+" : ""}${bond.change_bp}bp（基点）`,
    });
  }

  const lead = us?.leading[0];
  if (lead) {
    out.push({
      theme: "美股资金流向",
      signal: `${lead.sector}占优`,
      confidence: lead.change_pct >= 1.5 ? 0.6 : 0.44,
      trigger: `美股行业标的中 ${lead.sector} 领涨 ${pct(lead.change_pct)}`,
    });
  }

  return out;
}

/** 实时抓取简报所需的硬数据（与指数看板同源：Yahoo Finance）。 */
export async function getMacroMarketData(): Promise<MacroMarketData> {
  const cacheKey = "macro_briefing_market_v2";
  const cached = await readCache<MacroMarketData>(cacheKey);
  if (cached) return cached;

  const symbols = [
    ...INDEX_DEFS.map((d) => d.symbol),
    ...FX_DEFS.map((d) => d.symbol),
    ...COMMODITY_DEFS.map((d) => d.symbol),
    ...BOND_DEFS.map((d) => d.symbol),
    "^VIX",
    ...SECTOR_DEFS_US.map((d) => d.symbol),
    ...SECTOR_DEFS_HK.map((d) => d.symbol),
  ];
  const all = await snapAll(symbols);
  let at = 0;
  const take = (n: number) => all.slice(at, (at += n));
  const indexSnaps = take(INDEX_DEFS.length);
  const fxSnaps = take(FX_DEFS.length);
  const cmdSnaps = take(COMMODITY_DEFS.length);
  const bondSnaps = take(BOND_DEFS.length);
  const vix = take(1)[0] ?? null;
  const sectorSnaps = take(SECTOR_DEFS_US.length);
  const sectorSnapsHk = take(SECTOR_DEFS_HK.length);



  const indices: IndexQuote[] = [];
  INDEX_DEFS.forEach((d, i) => {
    const s = indexSnaps[i];
    if (s) indices.push({ name: d.name, change_pct: Number(s.changePct.toFixed(2)) });
  });

  const fx: FxQuote[] = [];
  FX_DEFS.forEach((d, i) => {
    const s = fxSnaps[i];
    if (s)
      fx.push({
        pair: d.pair,
        value: Number(s.value.toFixed(4)),
        change_pct: Number(s.changePct.toFixed(2)),
      });
  });

  const commodities: CommodityQuote[] = [];
  COMMODITY_DEFS.forEach((d, i) => {
    const s = cmdSnaps[i];
    if (s)
      commodities.push({
        name: d.name,
        value: Number(s.value.toFixed(2)),
        change_pct: Number(s.changePct.toFixed(2)),
      });
  });


  const bond_yields: BondYield[] = [];
  BOND_DEFS.forEach((d, i) => {
    const s = bondSnaps[i];
    if (!s) return;
    // ^TNX/^FVX 报的是收益率百分点，涨跌换算为基点（1 个百分点 = 100bp）。
    const prev = s.value / (1 + s.changePct / 100);
    bond_yields.push({
      name: d.name,
      value: Number(s.value.toFixed(2)),
      change_bp: Math.round((s.value - prev) * 100),
    });
  });

  const overview: GlobalMarketOverview | null =
    indices.length || fx.length || commodities.length || bond_yields.length || vix
      ? {
          indices,
          vix: vix ? Number(vix.value.toFixed(2)) : 0,
          vix_change_pct: vix ? Number(vix.changePct.toFixed(2)) : 0,
          fx,
          commodities,
          bond_yields,
        }
      : null;

  const rotation = rotationOf(SECTOR_DEFS_US, sectorSnaps, "US");
  const rotationHk = rotationOf(SECTOR_DEFS_HK, sectorSnapsHk, "HK");

  // 简报日期锚定标普 500 的最新交易日，避免亚洲市场先收盘把日期推到「明天」。
  const anchor = indexSnaps[0]?.date ?? indexSnaps.find(Boolean)?.date ?? null;
  const today = etStamp().slice(0, 10);

  const payload: MacroMarketData = {
    date: anchor && anchor <= today ? anchor : today,
    fetched_at: etStamp(),
    global_market_overview: overview,
    sector_rotation: rotation,
    sector_rotation_hk: rotationHk,
    trend_signals: buildTrendSignals(overview, rotation, rotationHk),
  };


  // 全线取数失败时不写缓存，避免把空数据固化 5 分钟。
  if (overview) await writeCache(cacheKey, payload, 300);

  return payload;
}
