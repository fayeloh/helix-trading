import { aiJson, GUARDRAILS, AI_MODEL_FAST } from "./ai.server";
import { INDEX_BOARD } from "./constants";
import {
  dailyChanges,
  fetchSeries,
  readCache,
  readStaleCache,
  writeCache,
  type Candle,
  type DailyChange,
} from "./market.server";

export type IndexRow = {
  symbol: string;
  label: string;
  group: string;
  price: number | null;
  currency: string | null;
  source?: string | undefined;
  days: DailyChange[];
  error?: string;
};

export type IndexBoard = {
  rows: IndexRow[];
  fetchedAt: string;
};

export type BoardDef = { symbol: string; label: string; group: string };

function hashKey(defs: BoardDef[]): string {
  const s = defs.map((d) => d.symbol).join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function getIndexBoardData(
  defs?: BoardDef[],
): Promise<IndexBoard> {
  const list: BoardDef[] = defs && defs.length > 0 ? defs : INDEX_BOARD;
  const cacheKey = `index_board_v4_${hashKey(list)}`;
  const cached = await readCache<IndexBoard>(cacheKey);
  // Do not let an all-empty provider response become the page's 10-minute
  // cache. It hides a later provider recovery and makes the board look broken.
  if (
    cached &&
    cached.rows.some((row) => row.days.length > 0 || row.price != null)
  )
    return cached;

  const rows = await Promise.all(
    list.map(async (def): Promise<IndexRow> => {
      try {
        const series = await fetchSeries(def.symbol, "1mo", "1d");
        return {
          symbol: def.symbol,
          label: def.label,
          group: def.group,
          price: series.price,
          currency: series.currency,
          source: series.source,
          days: dailyChanges(series.candles, 5),
        };
      } catch (e) {
        return {
          symbol: def.symbol,
          label: def.label,
          group: def.group,
          price: null,
          currency: null,
          days: [],
          error: e instanceof Error ? e.message : "数据不可用",
        };
      }
    }),
  );

  const hasUsableRows = rows.some(
    (row) => row.days.length > 0 || row.price != null,
  );
  if (!hasUsableRows) {
    const stale = await readStaleCache<IndexBoard>(cacheKey);
    if (stale) return stale;
  }

  const board: IndexBoard = { rows, fetchedAt: new Date().toISOString() };
  if (hasUsableRows) await writeCache(cacheKey, board, 600);
  return board;
}

export type Attribution = {
  symbol: string;
  driver: string;
  logic: string;
  kind: "fact" | "inference";
  confidence: "high" | "medium" | "low" | null;
};

const ATTRIBUTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "caveats"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["symbol", "driver", "logic", "kind", "confidence"],
        properties: {
          symbol: { type: "string" },
          driver: { type: "string", description: "一句话主因，不超过 30 字" },
          logic: { type: "string", description: "逻辑链条，1-2 句" },
          kind: { type: "string", enum: ["fact", "inference"] },
          confidence: {
            type: ["string", "null"],
            enum: ["high", "medium", "low", null],
          },
        },
      },
    },
    caveats: { type: "string" },
  },
};

export async function getAttributionsData(
  defs?: BoardDef[],
): Promise<{ items: Attribution[]; caveats: string }> {
  const board = await getIndexBoardData(defs);
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `index_attribution_${today}_${hashKey(board.rows)}`;
  const cached = await readCache<{ items: Attribution[]; caveats: string }>(
    cacheKey,
  );
  if (cached) return cached;

  const lines = board.rows
    .filter((r) => r.days.length > 0)
    .map((r) => {
      const d = r.days.at(-1)!;
      const prev = r.days
        .slice(0, -1)
        .map((x) => `${x.date}:${x.changePct?.toFixed(2) ?? "-"}%`)
        .join(", ");
      return `${r.label}(${r.symbol}) 最新交易日 ${d.date} 涨跌 ${d.changePct?.toFixed(2) ?? "-"}%，收 ${d.close}；前几日 ${prev}`;
    })
    .join("\n");

  const result = await aiJson<{ items: Attribution[]; caveats: string }>({
    model: AI_MODEL_FAST,
    schemaName: "index_attribution",
    schema: ATTRIBUTION_SCHEMA,
    system: `${GUARDRAILS}\n你在为全球指数看板撰写每日涨跌归因。归因必须给出可验证的驱动因素（宏观数据、政策、财报、资金面、事件）与逻辑链。若你无法确认当日具体消息，driver 写 "unknown"，logic 说明只能给出与波动幅度一致的通用可能性，kind 设为 "inference"，confidence 设为 "low"。`,
    user: `以下是真实行情数据（来自 FRED、Coinbase、CoinGecko、Stooq、Twelve Data、Alpha Vantage、Finnhub、FMP 或 Yahoo Finance 的可用源，抓取时间 ${board.fetchedAt}）。请为每个标的的最新交易日涨跌给出归因，symbol 必须与输入完全一致。\n\n${lines}`,
  });

  await writeCache(cacheKey, result, 60 * 60 * 6);
  return result;
}

export type ChartData = {
  symbol: string;
  currency: string | null;
  price: number | null;
  previousClose: number | null;
  source?: string | undefined;
  candles: Candle[];
};

const RANGE_MAP: Record<
  string,
  { range: string; interval: string; ttl: number }
> = {
  "1D": { range: "1d", interval: "5m", ttl: 300 },
  "5D": { range: "5d", interval: "30m", ttl: 600 },
  "1M": { range: "1mo", interval: "1d", ttl: 1800 },
  "3M": { range: "3mo", interval: "1d", ttl: 1800 },
  "1Y": { range: "1y", interval: "1d", ttl: 3600 },
};

export async function getChartData(
  symbol: string,
  rangeKey: string,
): Promise<ChartData> {
  const cfg = RANGE_MAP[rangeKey] ?? RANGE_MAP["1M"]!;
  const cacheKey = `chart_v2_${symbol}_${rangeKey}`;
  const cached = await readCache<ChartData>(cacheKey);
  if (cached) return cached;

  const series = await fetchSeries(symbol, cfg.range, cfg.interval);
  const payload: ChartData = {
    symbol,
    currency: series.currency,
    price: series.price,
    previousClose: series.previousClose,
    source: series.source,
    candles: series.candles,
  };
  await writeCache(cacheKey, payload, cfg.ttl);
  return payload;
}

/** Resolve a user-entered symbol to a Yahoo ticker per market. */
export function yahooSymbol(symbol: string, market: string): string {
  const s = symbol.trim().toUpperCase();
  if (s.includes(".") || s.includes("-") || s.startsWith("^")) return s;
  if (market === "HK") return `${s.replace(/^0+/, "").padStart(4, "0")}.HK`;
  if (market === "CN") return s.startsWith("6") ? `${s}.SS` : `${s}.SZ`;
  if (market === "CRYPTO") return `${s}-USD`;
  return s;
}

export async function getQuotesData(
  items: { symbol: string; market: string }[],
): Promise<
  Record<
    string,
    { price: number | null; currency: string | null; changePct: number | null }
  >
> {
  const out: Record<
    string,
    { price: number | null; currency: string | null; changePct: number | null }
  > = {};
  await Promise.all(
    items.map(async (it) => {
      const y = yahooSymbol(it.symbol, it.market);
      const key = `quote_${y}`;
      const cached = await readCache<{
        price: number | null;
        currency: string | null;
        changePct: number | null;
      }>(key);
      if (cached) {
        out[it.symbol] = cached;
        return;
      }
      try {
        const series = await fetchSeries(y, "5d", "1d");
        const last = series.candles.at(-1)?.c ?? null;
        const prev = series.candles.at(-2)?.c ?? series.previousClose;
        const value = {
          price: series.price ?? last,
          currency: series.currency,
          changePct: last != null && prev ? ((last - prev) / prev) * 100 : null,
        };
        await writeCache(key, value, 600);
        out[it.symbol] = value;
      } catch {
        out[it.symbol] = { price: null, currency: null, changePct: null };
      }
    }),
  );
  return out;
}
