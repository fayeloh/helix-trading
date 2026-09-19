import {
  fetchSeries,
  readCache,
  writeCache,
  type Candle,
} from "./market.server";

export type MonthStat = {
  month: number;
  samples: number;
  avg_return_pct: number | null;
  win_rate_pct: number | null;
  best_return_pct: number | null;
  worst_return_pct: number | null;
  year_high_count: number;
  year_low_count: number;
};

export type Seasonality = {
  symbol: string;
  months: MonthStat[];
  complete_years: number;
  first_year: number | null;
  last_year: number | null;
  strongest_months: number[];
  weakest_months: number[];
  top_year_high_month: number | null;
  top_year_low_month: number | null;
  source: string;
  as_of: string;
};

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * 纯函数：用月线算季节性。除月均涨跌与胜率外，还统计「年度最高价 / 最低价出现在该月」的次数，
 * 只统计有完整 12 根月线的年份，避免残缺年份污染高低点口径。
 */
export function computeSeasonality(
  symbol: string,
  candles: Candle[],
): Seasonality {
  const byYear = new Map<number, { m: number; c: Candle }[]>();
  for (const c of candles) {
    const d = new Date(c.t);
    const y = d.getUTCFullYear();
    const list = byYear.get(y) ?? [];
    list.push({ m: d.getUTCMonth() + 1, c });
    byYear.set(y, list);
  }

  const returns: number[][] = Array.from({ length: 13 }, () => []);
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]!;
    const cur = candles[i]!;
    if (!prev.c) continue;
    const m = new Date(cur.t).getUTCMonth() + 1;
    returns[m]!.push(((cur.c - prev.c) / prev.c) * 100);
  }

  const highCount = new Array(13).fill(0) as number[];
  const lowCount = new Array(13).fill(0) as number[];
  let completeYears = 0;
  const years: number[] = [];
  for (const [y, list] of byYear) {
    if (list.length < 12) continue;
    completeYears++;
    years.push(y);
    let hi = list[0]!;
    let lo = list[0]!;
    for (const row of list) {
      if (row.c.h > hi.c.h) hi = row;
      if (row.c.l < lo.c.l) lo = row;
    }
    highCount[hi.m]! += 1;
    lowCount[lo.m]! += 1;
  }
  years.sort((a, b) => a - b);

  const months: MonthStat[] = [];
  for (let m = 1; m <= 12; m++) {
    const rs = returns[m]!;
    const wins = rs.filter((v) => v > 0).length;
    months.push({
      month: m,
      samples: rs.length,
      avg_return_pct: rs.length
        ? r2(rs.reduce((a, b) => a + b, 0) / rs.length)
        : null,
      win_rate_pct: rs.length ? r2((wins / rs.length) * 100) : null,
      best_return_pct: rs.length ? r2(Math.max(...rs)) : null,
      worst_return_pct: rs.length ? r2(Math.min(...rs)) : null,
      year_high_count: highCount[m]!,
      year_low_count: lowCount[m]!,
    });
  }

  const ranked = months
    .filter((x) => x.avg_return_pct !== null)
    .sort((a, b) => b.avg_return_pct! - a.avg_return_pct!);
  const maxHigh = Math.max(...highCount.slice(1));
  const maxLow = Math.max(...lowCount.slice(1));

  return {
    symbol,
    months,
    complete_years: completeYears,
    first_year: years[0] ?? null,
    last_year: years.at(-1) ?? null,
    strongest_months: ranked.slice(0, 3).map((x) => x.month),
    weakest_months: ranked
      .slice(-3)
      .map((x) => x.month)
      .reverse(),
    top_year_high_month: maxHigh > 0 ? highCount.indexOf(maxHigh) : null,
    top_year_low_month: maxLow > 0 ? lowCount.indexOf(maxLow) : null,
    source: "多源免费行情月线",
    as_of: new Date().toISOString(),
  };
}

/** 取近 10 年月线并聚合季节性，缓存 24 小时。 */
export async function getSeasonality(
  ysym: string,
): Promise<Seasonality | null> {
  const cacheKey = `seasonality_v1_${ysym}`;
  try {
    const cached = await readCache<Seasonality>(cacheKey);
    if (cached) return cached;
  } catch {
    /* 缓存不可用时直接取数 */
  }

  let candles: Candle[] = [];
  try {
    candles = (await fetchSeries(ysym, "10y", "1mo")).candles;
  } catch {
    return null;
  }
  if (candles.length < 24) return null;

  const data = computeSeasonality(ysym, candles);
  try {
    await writeCache(cacheKey, data, 24 * 60 * 60);
  } catch {
    /* 忽略缓存写入失败 */
  }
  return data;
}
