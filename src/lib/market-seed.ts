import type { Candle, SeriesResult } from "./market.server";

type Seed = { currency: string; rows: [string, number][] };

// Public daily observations downloaded from FRED on 2026-09-19. These are an
// offline safety net only; live Yahoo/FMP data and stored database history take
// precedence whenever available.
const SEEDS: Record<string, Seed> = {
  "^GSPC": {
    currency: "USD",
    rows: [
      ["2026-09-02", 7666.6], ["2026-09-03", 7747.71], ["2026-09-04", 7718.6],
      ["2026-09-08", 7673.52], ["2026-09-09", 7636.36], ["2026-09-10", 7591.7],
      ["2026-09-11", 7656.98], ["2026-09-14", 7619.98], ["2026-09-15", 7585.73],
      ["2026-09-16", 7551.81], ["2026-09-17", 7637.76],
    ],
  },
  "^IXIC": {
    currency: "USD",
    rows: [
      ["2026-09-02", 26217.83], ["2026-09-03", 26584.06], ["2026-09-04", 26506.99],
      ["2026-09-08", 26421.41], ["2026-09-09", 26253.34], ["2026-09-10", 26081.72],
      ["2026-09-11", 26333.04], ["2026-09-14", 26186.41], ["2026-09-15", 25981.57],
      ["2026-09-16", 25978.42], ["2026-09-17", 26418.3], ["2026-09-18", 26522.55],
    ],
  },
  "^DJI": {
    currency: "USD",
    rows: [
      ["2026-09-03", 53686.11], ["2026-09-04", 53414.25], ["2026-09-08", 52786.07],
      ["2026-09-09", 52380.66], ["2026-09-10", 52064.1], ["2026-09-11", 52573.29],
      ["2026-09-14", 52421.2], ["2026-09-15", 52093.11], ["2026-09-16", 51461.9],
      ["2026-09-17", 51778.04], ["2026-09-18", 51682.64],
    ],
  },
  "^VIX": {
    currency: "USD",
    rows: [
      ["2026-09-02", 15.2], ["2026-09-03", 14.32], ["2026-09-04", 14.53],
      ["2026-09-07", 15.3], ["2026-09-08", 15.72], ["2026-09-09", 16.46],
      ["2026-09-10", 17.84], ["2026-09-11", 15.84], ["2026-09-14", 17.1],
      ["2026-09-15", 17.2], ["2026-09-16", 17.71], ["2026-09-17", 15.44],
    ],
  },
  "^TNX": {
    currency: "USD",
    rows: [
      ["2026-09-02", 4.79], ["2026-09-03", 4.77], ["2026-09-04", 4.78],
      ["2026-09-08", 4.8], ["2026-09-09", 4.83], ["2026-09-10", 4.95],
      ["2026-09-11", 4.96], ["2026-09-14", 4.97], ["2026-09-15", 5],
      ["2026-09-16", 5.01], ["2026-09-17", 4.94],
    ],
  },
};

export function getSeedSeries(symbol: string): SeriesResult | null {
  const seed = SEEDS[symbol];
  if (!seed) return null;
  const candles: Candle[] = seed.rows.map(([date, close]) => ({
    t: new Date(`${date}T00:00:00Z`).getTime(),
    c: close,
    o: close,
    h: close,
    l: close,
  }));
  return {
    symbol,
    currency: seed.currency,
    price: candles.at(-1)?.c ?? null,
    previousClose: candles.at(-2)?.c ?? null,
    shortName: symbol,
    longName: symbol,
    exchange: null,
    instrumentType: "INDEX",
    candles,
  };
}
