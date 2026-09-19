import { getQuotesData } from "./market-api.server";
import {
  computeImpactReview,
  resolveSymbols,
  type Baseline,
  type BaselineHolding,
  type ImpactReview,
} from "./impacts.server";

export async function computeBaseline(input: {
  targets: { target: string }[];
  sectors: string[];
  extraSymbols: string[];
  holdings: BaselineHolding[];
}): Promise<{ symbols: string[]; baseline: Baseline }> {
  const resolved = resolveSymbols(input.targets, input.sectors, input.holdings);
  const symbols = [...new Set([...input.extraSymbols.map((s) => s.toUpperCase()), ...resolved])].slice(
    0,
    12,
  );

  const markets: Record<string, string> = {};
  for (const h of input.holdings) markets[h.symbol] = h.market;
  const quoteItems = [
    ...symbols.map((s) => ({ symbol: s, market: markets[s] ?? "US" })),
    ...input.holdings.map((h) => ({ symbol: h.symbol, market: h.market })),
  ];

  const quotes = quoteItems.length ? await getQuotesData(quoteItems) : {};
  const prices: Record<string, number | null> = {};
  for (const [symbol, q] of Object.entries(quotes)) prices[symbol] = q.price;

  return {
    symbols,
    baseline: {
      recordedAt: new Date().toISOString(),
      prices,
      holdings: input.holdings,
      markets,
    },
  };
}

export type ImpactRowWithReview = {
  id: string;
  event_kind: string;
  title: string;
  published_at: string | null;
  source: string | null;
  direction: string;
  impact_targets: { target: string; direction?: string; reasoning?: string }[];
  symbols: string[];
  note: string | null;
  recorded_at: string;
  review: ImpactReview;
};

export async function reviewRows(
  rows: {
    id: string;
    event_kind: string;
    title: string;
    published_at: string | null;
    source: string | null;
    direction: string;
    impact_targets: unknown;
    symbols: string[] | null;
    baseline: unknown;
    note: string | null;
    recorded_at: string;
  }[],
): Promise<ImpactRowWithReview[]> {
  return await Promise.all(
    rows.map(async (r) => {
      const baseline = (r.baseline ?? {}) as Baseline;
      const safeBaseline: Baseline = {
        recordedAt: baseline.recordedAt ?? r.recorded_at,
        prices: baseline.prices ?? {},
        holdings: baseline.holdings ?? [],
        markets: baseline.markets ?? {},
      };
      const review = await computeImpactReview(r.symbols ?? [], safeBaseline, r.direction);
      return {
        id: r.id,
        event_kind: r.event_kind,
        title: r.title,
        published_at: r.published_at,
        source: r.source,
        direction: r.direction,
        impact_targets: (Array.isArray(r.impact_targets) ? r.impact_targets : []) as ImpactRowWithReview["impact_targets"],
        symbols: r.symbols ?? [],
        note: r.note,
        recorded_at: r.recorded_at,
        review,
      };
    }),
  );
}
