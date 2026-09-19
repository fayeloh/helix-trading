import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSeedSeries } from "./market-seed";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const FMP_BASE = "https://financialmodelingprep.com";

export type Candle = { t: number; c: number; o: number; h: number; l: number };

export type SeriesResult = {
  symbol: string;
  currency: string | null;
  price: number | null;
  previousClose: number | null;
  shortName: string | null;
  longName: string | null;
  exchange: string | null;
  instrumentType: string | null;
  candles: Candle[];
};

export async function readCache<T>(key: string): Promise<T | null> {
  // 缓存是性能优化，不应成为外部数据源的硬依赖。
  // 本地开发或未配置 service-role key 时直接跳过缓存，继续请求实时源。
  try {
    const { data } = await supabaseAdmin
      .from("market_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

/** Read an expired snapshot only as a last-resort display fallback. */
export async function readStaleCache<T>(key: string): Promise<T | null> {
  try {
    const { data } = await supabaseAdmin
      .from("market_cache")
      .select("payload")
      .eq("cache_key", key)
      .maybeSingle();
    return data?.payload as T | null;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, payload: unknown, ttlSeconds: number) {
  try {
    await supabaseAdmin.from("market_cache").upsert({
      cache_key: key,
      payload: payload as never,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    });
  } catch {
    // 缓存写入失败不影响实时数据返回。
  }
}

/**
 * 永久历史行情缓存：market_cache 只是复用现有服务端缓存表，历史数据
 * 使用很长 TTL 保存，只有成功拿到更新数据时才覆盖。
 */
async function readStoredSeries(symbol: string, range: string): Promise<SeriesResult | null> {
  return readCache<SeriesResult>(`series_history_v1_${symbol}_${range}`);
}

async function writeStoredSeries(symbol: string, range: string, series: SeriesResult) {
  // 十年 TTL 代表长期历史快照，而不是 10 分钟页面缓存。
  await writeCache(`series_history_v1_${symbol}_${range}`, series, 10 * 365 * 24 * 60 * 60);
}

type FmpBar = {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
};

function fmpSymbol(symbol: string): string {
  // FMP uses the same symbols for US equities and most FX pairs. These
  // normalizations cover the common Yahoo aliases used by the dashboard.
  return symbol
    .replace(/^\^GSPC$/, "SP500")
    .replace(/^\^IXIC$/, "COMP");
}

function fromDate(range: string): string {
  const days = range === "1y" ? 370 : range === "3mo" ? 100 : range === "1mo" ? 40 : 10;
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function fetchFmpSeries(symbol: string, range: string): Promise<SeriesResult | null> {
  const apiKey = process.env["FMP_API_KEY"];
  if (!apiKey) return null;
  const fmp = fmpSymbol(symbol);
  const urls = [
    `${FMP_BASE}/stable/historical-price-eod/full?symbol=${encodeURIComponent(fmp)}&from=${fromDate(range)}&apikey=${encodeURIComponent(apiKey)}`,
    `${FMP_BASE}/api/v3/historical-price-full/${encodeURIComponent(fmp)}?from=${fromDate(range)}&apikey=${encodeURIComponent(apiKey)}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const body = (await res.json()) as FmpBar[] | { historical?: FmpBar[] };
      const rows = Array.isArray(body) ? body : body.historical ?? [];
      const candles = rows
        .filter((r) => r.date && typeof r.close === "number")
        .map((r) => ({
          t: new Date(`${r.date}T00:00:00Z`).getTime(),
          c: r.close!,
          o: r.open ?? r.close!,
          h: r.high ?? r.close!,
          l: r.low ?? r.close!,
        }))
        .sort((a, b) => a.t - b.t);
      if (!candles.length) continue;
      const series: SeriesResult = {
        symbol,
        currency: /\.HK$/.test(symbol) ? "HKD" : /\.SS$|\.SZ$/.test(symbol) ? "CNY" : "USD",
        price: candles.at(-1)?.c ?? null,
        previousClose: candles.at(-2)?.c ?? null,
        shortName: symbol,
        longName: symbol,
        exchange: null,
        instrumentType: null,
        candles,
      };
      await writeStoredSeries(symbol, range, series);
      return series;
    } catch {
      // Try the legacy endpoint before reporting the original Yahoo error.
    }
  }
  return null;
}

/** Yahoo Finance chart endpoint — free, no API key [默认方案，可调整] */
export async function fetchSeries(
  symbol: string,
  range: string,
  interval: string,
): Promise<SeriesResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=${range}&interval=${interval}&includePrePost=false`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  } catch (error) {
    const fallback = await fetchFmpSeries(symbol, range);
    if (fallback) return fallback;
    const stored = await readStoredSeries(symbol, range);
    if (stored) return stored;
    const seed = getSeedSeries(symbol);
    if (seed) {
      await writeStoredSeries(symbol, range, seed);
      return seed;
    }
    throw error;
  }
  if (!res.ok) {
    const fallback = await fetchFmpSeries(symbol, range);
    if (fallback) return fallback;
    const stored = await readStoredSeries(symbol, range);
    if (stored) return stored;
    const seed = getSeedSeries(symbol);
    if (seed) {
      await writeStoredSeries(symbol, range, seed);
      return seed;
    }
    throw new Error(`行情源返回 ${res.status}`);
  }
  const json = (await res.json()) as {
    chart?: {
      result?: {
        meta?: {
          currency?: string;
          regularMarketPrice?: number;
          chartPreviousClose?: number;
          shortName?: string;
          longName?: string;
          exchangeName?: string;
          fullExchangeName?: string;
          instrumentType?: string;
        };
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[]; open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[] }[] };
      }[];
      error?: { description?: string };
    };
  };

  const result = json.chart?.result?.[0];
  if (!result) {
    const fallback = await fetchFmpSeries(symbol, range);
    if (fallback) return fallback;
    const stored = await readStoredSeries(symbol, range);
    if (stored) return stored;
    const seed = getSeedSeries(symbol);
    if (seed) {
      await writeStoredSeries(symbol, range, seed);
      return seed;
    }
    throw new Error(json.chart?.error?.description ?? "无行情数据");
  }

  const q = result.indicators?.quote?.[0] ?? {};
  const ts = result.timestamp ?? [];
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i];
    if (c == null) continue;
    candles.push({
      t: ts[i]! * 1000,
      c,
      o: q.open?.[i] ?? c,
      h: q.high?.[i] ?? c,
      l: q.low?.[i] ?? c,
    });
  }

  const series: SeriesResult = {
    symbol,
    currency: result.meta?.currency ?? null,
    price: result.meta?.regularMarketPrice ?? candles.at(-1)?.c ?? null,
    previousClose: result.meta?.chartPreviousClose ?? null,
    shortName: result.meta?.shortName ?? null,
    longName: result.meta?.longName ?? null,
    exchange: result.meta?.fullExchangeName ?? result.meta?.exchangeName ?? null,
    instrumentType: result.meta?.instrumentType ?? null,
    candles,
  };
  await writeStoredSeries(symbol, range, series);
  return series;
}

export type DailyChange = { date: string; changePct: number | null; close: number };

export function dailyChanges(candles: Candle[], count: number): DailyChange[] {
  const out: DailyChange[] = [];
  for (let i = candles.length - count; i < candles.length; i++) {
    if (i <= 0) continue;
    const cur = candles[i]!;
    const prev = candles[i - 1]!;
    out.push({
      date: new Date(cur.t).toISOString().slice(0, 10),
      close: cur.c,
      changePct: prev.c ? ((cur.c - prev.c) / prev.c) * 100 : null,
    });
  }
  return out;
}
