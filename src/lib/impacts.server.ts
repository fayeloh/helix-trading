import { fetchSeries } from "./market.server";
import { yahooSymbol } from "./market-api.server";

export type BaselineHolding = {
  symbol: string;
  market: string;
  quantity: number;
  avg_cost: number;
  sector: string | null;
};

export type Baseline = {
  recordedAt: string;
  prices: Record<string, number | null>;
  holdings: BaselineHolding[];
  markets: Record<string, string>;
};

export type SymbolOutcome = {
  symbol: string;
  basePrice: number | null;
  d1: number | null;
  d3: number | null;
  w1: number | null;
  since: number | null;
  latestPrice: number | null;
};

export type ImpactReview = {
  symbols: SymbolOutcome[];
  realizedDirection: "bullish" | "bearish" | "neutral" | "unknown";
  avgSince: number | null;
  portfolio: {
    baseValue: number | null;
    nowValue: number | null;
    deltaPct: number | null;
    deltaAmount: number | null;
  };
};

function pct(from: number | null | undefined, to: number | null | undefined): number | null {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

/** Price at (baseline + n calendar days), using the last candle at or before that moment. */
function priceAfter(candles: { t: number; c: number }[], baseMs: number, days: number): number | null {
  const target = baseMs + days * 24 * 3600 * 1000;
  if (Date.now() < target) return null;
  let out: number | null = null;
  for (const c of candles) {
    if (c.t <= target) out = c.c;
    else break;
  }
  return out;
}

function priceAt(candles: { t: number; c: number }[], baseMs: number): number | null {
  let out: number | null = null;
  for (const c of candles) {
    if (c.t <= baseMs) out = c.c;
    else break;
  }
  return out ?? candles[0]?.c ?? null;
}

export async function computeImpactReview(
  symbols: string[],
  baseline: Baseline,
  direction: string,
): Promise<ImpactReview> {
  const baseMs = new Date(baseline.recordedAt).getTime();
  const list = symbols.slice(0, 12);

  const outcomes = await Promise.all(
    list.map(async (symbol): Promise<SymbolOutcome> => {
      const market = baseline.markets[symbol] ?? "US";
      try {
        const series = await fetchSeries(yahooSymbol(symbol, market), "3mo", "1d");
        const candles = series.candles;
        const basePrice = baseline.prices[symbol] ?? priceAt(candles, baseMs);
        const latest = series.price ?? candles.at(-1)?.c ?? null;
        return {
          symbol,
          basePrice,
          d1: pct(basePrice, priceAfter(candles, baseMs, 1)),
          d3: pct(basePrice, priceAfter(candles, baseMs, 3)),
          w1: pct(basePrice, priceAfter(candles, baseMs, 7)),
          since: pct(basePrice, latest),
          latestPrice: latest,
        };
      } catch {
        return {
          symbol,
          basePrice: baseline.prices[symbol] ?? null,
          d1: null,
          d3: null,
          w1: null,
          since: null,
          latestPrice: null,
        };
      }
    }),
  );

  const sinceVals = outcomes.map((o) => o.since).filter((v): v is number => v != null);
  const avgSince = sinceVals.length ? sinceVals.reduce((a, b) => a + b, 0) / sinceVals.length : null;

  let realized: ImpactReview["realizedDirection"] = "unknown";
  if (avgSince != null) realized = avgSince > 0.5 ? "bullish" : avgSince < -0.5 ? "bearish" : "neutral";
  void direction;

  // Portfolio-level impact: value the recorded holdings at baseline vs now.
  const holdingSymbols = baseline.holdings.map((h) => h.symbol);
  const quoteMap = new Map<string, number | null>();
  await Promise.all(
    holdingSymbols.map(async (symbol) => {
      const existing = outcomes.find((o) => o.symbol === symbol);
      if (existing?.latestPrice != null) {
        quoteMap.set(symbol, existing.latestPrice);
        return;
      }
      const h = baseline.holdings.find((x) => x.symbol === symbol)!;
      try {
        const series = await fetchSeries(yahooSymbol(symbol, h.market), "5d", "1d");
        quoteMap.set(symbol, series.price ?? series.candles.at(-1)?.c ?? null);
      } catch {
        quoteMap.set(symbol, null);
      }
    }),
  );

  let baseValue = 0;
  let nowValue = 0;
  let usable = false;
  for (const h of baseline.holdings) {
    const bp = baseline.prices[h.symbol];
    const np = quoteMap.get(h.symbol) ?? null;
    if (bp == null || np == null) continue;
    usable = true;
    baseValue += bp * h.quantity;
    nowValue += np * h.quantity;
  }

  return {
    symbols: outcomes,
    realizedDirection: realized,
    avgSince,
    portfolio: usable
      ? {
          baseValue,
          nowValue,
          deltaPct: pct(baseValue, nowValue),
          deltaAmount: nowValue - baseValue,
        }
      : { baseValue: null, nowValue: null, deltaPct: null, deltaAmount: null },
  };
}

const TICKER_RE = /^[A-Z]{1,6}(?:[.-][A-Z0-9]{1,5})?$|^\^[A-Z0-9]{2,8}$|^\d{3,5}\.HK$/;

/** Pull plausible tickers out of AI impact targets, then add holdings matching the sector tags. */
export function resolveSymbols(
  targets: { target: string }[],
  sectors: string[],
  holdings: BaselineHolding[],
): string[] {
  const out = new Set<string>();
  for (const t of targets) {
    const raw = t.target.trim().toUpperCase();
    const m = raw.match(/[A-Z^.\-0-9]{2,10}/g) ?? [];
    for (const cand of m) if (TICKER_RE.test(cand)) out.add(cand);
  }
  const tags = [...sectors, ...targets.map((t) => t.target)].map((s) => s.toLowerCase());
  for (const h of holdings) {
    const sector = (h.sector ?? "").toLowerCase();
    if (out.has(h.symbol)) continue;
    if (sector && tags.some((tag) => tag.includes(sector) || sector.includes(tag))) out.add(h.symbol);
  }
  return [...out].slice(0, 12);
}
