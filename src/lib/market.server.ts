import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

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
  const { data } = await supabaseAdmin
    .from("market_cache")
    .select("payload, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.payload as T;
}

export async function writeCache(key: string, payload: unknown, ttlSeconds: number) {
  await supabaseAdmin.from("market_cache").upsert({
    cache_key: key,
    payload: payload as never,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  });
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

  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`行情源返回 ${res.status}`);
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
  if (!result) throw new Error(json.chart?.error?.description ?? "无行情数据");

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

  return {
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
