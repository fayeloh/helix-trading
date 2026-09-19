import { fetchSeries, readCache, writeCache, type Candle } from "./market.server";

export type EarningsReaction = {
  report_date: string;
  base_date: string | null;
  base_close: number | null;
  d1_pct: number | null;
  d3_pct: number | null;
  d5_pct: number | null;
};

function day(c: Candle): string {
  return new Date(c.t).toISOString().slice(0, 10);
}

function pct(from: number, to: number): number | null {
  if (!from) return null;
  return Math.round(((to - from) / from) * 10000) / 100;
}

/**
 * 纯函数：按发布时点确定基准收盘（盘前=前一交易日收盘，盘后=当日收盘），
 * 再算之后 1/3/5 个交易日的累计涨跌幅。缺 K 线返回 null，绝不外推。
 */
export function computeReaction(
  candles: Candle[],
  reportDate: string,
  timing: "before_open" | "after_close" | "unknown",
): EarningsReaction {
  const empty: EarningsReaction = {
    report_date: reportDate,
    base_date: null,
    base_close: null,
    d1_pct: null,
    d3_pct: null,
    d5_pct: null,
  };
  if (candles.length === 0) return empty;

  // 最后一根 <= reportDate 的 K 线
  let at = -1;
  for (let i = 0; i < candles.length; i++) {
    if (day(candles[i]!) <= reportDate) at = i;
    else break;
  }
  if (at < 0) return empty;

  // 盘前发布：基准是发布日之前那根；未知时点按盘后处理（更常见）。
  const baseIdx = timing === "before_open" && day(candles[at]!) === reportDate ? at - 1 : at;
  const base = candles[baseIdx];
  if (!base) return empty;

  const rel = (n: number) => {
    const c = candles[baseIdx + n];
    return c ? pct(base.c, c.c) : null;
  };

  return {
    report_date: reportDate,
    base_date: day(base),
    base_close: base.c,
    d1_pct: rel(1),
    d3_pct: rel(3),
    d5_pct: rel(5),
  };
}

/** 取 2 年日线，为每个财报日期算出真实的财报后波动。结果缓存 12 小时。 */
export async function getEarningsReactions(
  ysym: string,
  reports: { report_date: string | null; timing: "before_open" | "after_close" | "unknown" }[],
): Promise<EarningsReaction[]> {
  const dates = reports.filter((r) => r.report_date);
  if (dates.length === 0) return [];

  const cacheKey = `earn_react_v1_${ysym}_${dates.map((d) => d.report_date).join(",")}`;
  try {
    const cached = await readCache<EarningsReaction[]>(cacheKey);
    if (cached) return cached;
  } catch {
    /* 缓存不可用时直接取数 */
  }

  let candles: Candle[] = [];
  try {
    candles = (await fetchSeries(ysym, "2y", "1d")).candles;
  } catch {
    return [];
  }
  if (candles.length === 0) return [];

  const out = dates.map((r) => computeReaction(candles, r.report_date!, r.timing));
  try {
    await writeCache(cacheKey, out, 12 * 60 * 60);
  } catch {
    /* 忽略缓存写入失败 */
  }
  return out;
}
