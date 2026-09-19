import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSeedSeries } from "./market-seed";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const FMP_BASE = "https://financialmodelingprep.com";
const DAY_MS = 86_400_000;
const FETCH_TIMEOUT_MS = 6_000;

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
  source?: string;
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

export async function writeCache(
  key: string,
  payload: unknown,
  ttlSeconds: number,
) {
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
async function readStoredSeries(
  symbol: string,
  range: string,
): Promise<SeriesResult | null> {
  return readCache<SeriesResult>(`series_history_v1_${symbol}_${range}`);
}

async function writeStoredSeries(
  symbol: string,
  range: string,
  series: SeriesResult,
) {
  // 十年 TTL 代表长期历史快照，而不是 10 分钟页面缓存。
  await writeCache(
    `series_history_v1_${symbol}_${range}`,
    series,
    10 * 365 * 24 * 60 * 60,
  );
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
  return symbol.replace(/^\^GSPC$/, "SP500").replace(/^\^IXIC$/, "COMP");
}

function fromDate(range: string): string {
  return new Date(Date.now() - daysForRange(range) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function seriesFromCandles(
  symbol: string,
  currency: string,
  candles: Candle[],
  source: string,
): SeriesResult | null {
  if (!candles.length) return null;
  return {
    symbol,
    currency,
    price: candles.at(-1)?.c ?? null,
    previousClose: candles.at(-2)?.c ?? null,
    shortName: symbol,
    longName: symbol,
    exchange: null,
    instrumentType: null,
    source,
    candles,
  };
}

function currencyForSymbol(symbol: string): string {
  if (/\.HK$/.test(symbol)) return "HKD";
  if (/\.SS$|\.SZ$/.test(symbol)) return "CNY";
  if (/USDJPY=X$/.test(symbol)) return "JPY";
  if (/USDCNY=X$/.test(symbol)) return "CNY";
  return "USD";
}

function daysForRange(range: string): number {
  if (range === "1d") return 7;
  if (range === "5d") return 14;
  if (range === "1mo") return 40;
  if (range === "3mo") return 100;
  if (range === "1y") return 370;
  if (range === "2y") return 740;
  if (range === "10y") return 3_700;
  return 370;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function stooqSymbol(symbol: string): string | null {
  const mapped: Record<string, string> = {
    "^GSPC": "^SPX",
    "^IXIC": "^NDQ",
    "^DJI": "^DJI",
    "^RUT": "^RUT",
    "^HSI": "^HSI",
    "^N225": "^NKX",
    "^GDAXI": "^DAX",
    "^FTSE": "^UKX",
    "^FCHI": "^CAC",
    "^STOXX50E": "^SX5E",
    "GC=F": "GC.F",
    "SI=F": "SI.F",
    "CL=F": "CL.F",
    "HG=F": "HG.F",
    "NG=F": "NG.F",
  };
  if (mapped[symbol]) return mapped[symbol]!;
  if (
    /^[A-Z][A-Z0-9.-]*$/.test(symbol) &&
    !symbol.includes("=") &&
    !symbol.startsWith("^")
  ) {
    return `${symbol}.US`;
  }
  return null;
}

async function fetchStooqSeries(
  symbol: string,
  range: string,
): Promise<SeriesResult | null> {
  const providerSymbol = stooqSymbol(symbol);
  if (!providerSymbol) return null;
  const end = new Date();
  const start = new Date(Date.now() - daysForRange(range) * DAY_MS);
  try {
    const res = await fetch(
      `https://stooq.com/q/d/l/?s=${encodeURIComponent(providerSymbol.toLowerCase())}&d1=${dateKey(start)}&d2=${dateKey(end)}&i=d`,
      {
        headers: { Accept: "text/csv", "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.startsWith("Date,")) return null;
    const candles = text
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(","))
      .filter((parts) => parts.length >= 5 && Number.isFinite(Number(parts[4])))
      .map(([date, open, high, low, close]) => ({
        t: new Date(`${date}T00:00:00Z`).getTime(),
        o: Number(open),
        h: Number(high),
        l: Number(low),
        c: Number(close),
      }));
    return seriesFromCandles(
      symbol,
      currencyForSymbol(symbol),
      candles,
      "Stooq",
    );
  } catch {
    return null;
  }
}

async function fetchCoinbaseSeries(
  symbol: string,
): Promise<SeriesResult | null> {
  if (!/^(BTC|ETH|SOL)-USD$/.test(symbol)) return null;
  try {
    const res = await fetch(
      `https://api.exchange.coinbase.com/products/${encodeURIComponent(symbol)}/candles?granularity=86400`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "HelixTrading/1.0",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ][];
    const candles = rows
      .map(([time, low, high, open, close]) => ({
        t: time * 1000,
        c: close,
        o: open,
        h: high,
        l: low,
      }))
      .sort((a, b) => a.t - b.t);
    return seriesFromCandles(symbol, "USD", candles, "Coinbase");
  } catch {
    return null;
  }
}

async function fetchCoinGeckoSeries(
  symbol: string,
  range: string,
): Promise<SeriesResult | null> {
  const coinIds: Record<string, string> = {
    "BTC-USD": "bitcoin",
    "ETH-USD": "ethereum",
    "SOL-USD": "solana",
    "BNB-USD": "binancecoin",
    "XRP-USD": "ripple",
  };
  const id = coinIds[symbol];
  if (!id) return null;
  try {
    const days = Math.min(daysForRange(range), 365);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "HelixTrading/1.0",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { prices?: [number, number][] };
    const candles = (body.prices ?? []).map(([time, close]) => ({
      t: time,
      c: close,
      o: close,
      h: close,
      l: close,
    }));
    return seriesFromCandles(symbol, "USD", candles, "CoinGecko");
  } catch {
    return null;
  }
}

async function fetchFredSeries(
  symbol: string,
  range: string,
): Promise<SeriesResult | null> {
  const fredId: Record<string, string> = {
    "^GSPC": "SP500",
    "^IXIC": "NASDAQCOM",
    "^DJI": "DJIA",
    "^RUT": "RU2000PR",
    "^VIX": "VIXCLS",
    "^TNX": "DGS10",
    "^TYX": "DGS30",
    "^FVX": "DGS5",
    "GC=F": "GOLDAMGBD228NLBM",
    "SI=F": "SLVPRUSD",
    "CL=F": "DCOILWTICO",
    "DX-Y.NYB": "DTWEXBGS",
    "USDCNY=X": "DEXCHUS",
    "USDJPY=X": "DEXJPUS",
  };
  const id = fredId[symbol];
  if (!id) return null;
  try {
    const res = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${fromDate(range)}`,
      {
        headers: { Accept: "text/csv", "User-Agent": "HelixTrading/1.0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const text = await res.text();
    const candles = text
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(","))
      .filter(
        (parts) => parts[0] && parts[1] && Number.isFinite(Number(parts[1])),
      )
      .map(([date, value]) => {
        const close = Number(value);
        return {
          t: new Date(`${date}T00:00:00Z`).getTime(),
          c: close,
          o: close,
          h: close,
          l: close,
        };
      });
    return seriesFromCandles(
      symbol,
      currencyForSymbol(symbol),
      candles,
      "FRED",
    );
  } catch {
    return null;
  }
}

/** Public, keyless sources. Each failure is isolated so another source can continue. */
async function fetchPublicSeries(
  symbol: string,
  range: string,
): Promise<SeriesResult | null> {
  if (symbol.endsWith("-USD")) {
    const crypto =
      (await fetchCoinbaseSeries(symbol)) ??
      (await fetchCoinGeckoSeries(symbol, range));
    if (crypto) return crypto;
  }

  const fred = await fetchFredSeries(symbol, range);
  if (fred) return fred;

  return fetchStooqSeries(symbol, range);
}

function twelveSymbol(symbol: string): string {
  const mapped: Record<string, string> = {
    "^GSPC": "SPX",
    "^IXIC": "IXIC",
    "^DJI": "DJI",
    "GC=F": "XAU/USD",
    "SI=F": "XAG/USD",
    "USDCNY=X": "USD/CNY",
    "USDJPY=X": "USD/JPY",
  };
  if (mapped[symbol]) return mapped[symbol]!;
  if (symbol.endsWith("-USD")) return symbol.replace("-", "/");
  return symbol.replace(/\.(SS|SZ|HK)$/, "");
}

async function fetchTwelveDataSeries(
  symbol: string,
  range: string,
  interval: string,
): Promise<SeriesResult | null> {
  const apiKey = process.env["TWELVE_DATA_API_KEY"];
  if (!apiKey) return null;
  const providerInterval =
    interval === "5m" ? "5min" : interval === "30m" ? "30min" : "1day";
  try {
    const params = new URLSearchParams({
      symbol: twelveSymbol(symbol),
      interval: providerInterval,
      outputsize: String(Math.min(daysForRange(range) + 10, 5000)),
      apikey: apiKey,
    });
    const res = await fetch(
      `https://api.twelvedata.com/time_series?${params}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      status?: string;
      meta?: { currency?: string };
      values?: {
        datetime: string;
        open: string;
        high: string;
        low: string;
        close: string;
      }[];
    };
    if (body.status === "error") return null;
    const candles = (body.values ?? [])
      .map((row) => ({
        t: new Date(
          row.datetime.replace(" ", "T") +
            (row.datetime.includes(" ") ? "Z" : "T00:00:00Z"),
        ).getTime(),
        o: Number(row.open),
        h: Number(row.high),
        l: Number(row.low),
        c: Number(row.close),
      }))
      .filter((row) => Number.isFinite(row.t) && Number.isFinite(row.c))
      .sort((a, b) => a.t - b.t);
    return seriesFromCandles(
      symbol,
      body.meta?.currency ?? currencyForSymbol(symbol),
      candles,
      "Twelve Data",
    );
  } catch {
    return null;
  }
}

async function fetchAlphaVantageSeries(
  symbol: string,
  range: string,
): Promise<SeriesResult | null> {
  const apiKey = process.env["ALPHA_VANTAGE_API_KEY"];
  if (
    !apiKey ||
    !/^[A-Z][A-Z0-9.-]*$/.test(symbol) ||
    symbol.startsWith("^") ||
    symbol.includes("=")
  )
    return null;
  try {
    const params = new URLSearchParams({
      function: "TIME_SERIES_DAILY",
      symbol,
      outputsize: daysForRange(range) > 100 ? "full" : "compact",
      apikey: apiKey,
    });
    const res = await fetch(`https://www.alphavantage.co/query?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, unknown>;
    const rows = body["Time Series (Daily)"] as
      Record<string, Record<string, string>> | undefined;
    if (!rows) return null;
    const cutoff = Date.now() - daysForRange(range) * DAY_MS;
    const candles = Object.entries(rows)
      .map(([date, row]) => ({
        t: new Date(`${date}T00:00:00Z`).getTime(),
        o: Number(row["1. open"]),
        h: Number(row["2. high"]),
        l: Number(row["3. low"]),
        c: Number(row["4. close"]),
      }))
      .filter((row) => row.t >= cutoff && Number.isFinite(row.c))
      .sort((a, b) => a.t - b.t);
    return seriesFromCandles(
      symbol,
      currencyForSymbol(symbol),
      candles,
      "Alpha Vantage",
    );
  } catch {
    return null;
  }
}

async function fetchFinnhubSeries(
  symbol: string,
  range: string,
): Promise<SeriesResult | null> {
  const apiKey = process.env["FINNHUB_API_KEY"];
  if (
    !apiKey ||
    !/^[A-Z][A-Z0-9.-]*$/.test(symbol) ||
    symbol.startsWith("^") ||
    symbol.includes("=")
  )
    return null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - daysForRange(range) * 86_400;
  try {
    const params = new URLSearchParams({
      symbol,
      resolution: "D",
      from: String(from),
      to: String(to),
      token: apiKey,
    });
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/candle?${params}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      s?: string;
      t?: number[];
      o?: number[];
      h?: number[];
      l?: number[];
      c?: number[];
    };
    if (body.s !== "ok") return null;
    const candles = (body.t ?? [])
      .map((time, i) => ({
        t: time * 1000,
        o: body.o?.[i] ?? body.c?.[i] ?? 0,
        h: body.h?.[i] ?? body.c?.[i] ?? 0,
        l: body.l?.[i] ?? body.c?.[i] ?? 0,
        c: body.c?.[i] ?? 0,
      }))
      .filter((row) => row.c > 0);
    return seriesFromCandles(
      symbol,
      currencyForSymbol(symbol),
      candles,
      "Finnhub",
    );
  } catch {
    return null;
  }
}

async function fetchFreeKeySeries(
  symbol: string,
  range: string,
  interval: string,
): Promise<SeriesResult | null> {
  return (
    (await fetchTwelveDataSeries(symbol, range, interval)) ??
    (await fetchAlphaVantageSeries(symbol, range)) ??
    (await fetchFinnhubSeries(symbol, range))
  );
}

async function fetchFmpSeries(
  symbol: string,
  range: string,
): Promise<SeriesResult | null> {
  const apiKey = process.env["FMP_API_KEY"];
  if (!apiKey) return null;
  const fmp = fmpSymbol(symbol);
  const urls = [
    `${FMP_BASE}/stable/historical-price-eod/full?symbol=${encodeURIComponent(fmp)}&from=${fromDate(range)}&apikey=${encodeURIComponent(apiKey)}`,
    `${FMP_BASE}/api/v3/historical-price-full/${encodeURIComponent(fmp)}?from=${fromDate(range)}&apikey=${encodeURIComponent(apiKey)}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as FmpBar[] | { historical?: FmpBar[] };
      const rows = Array.isArray(body) ? body : (body.historical ?? []);
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
        currency: /\.HK$/.test(symbol)
          ? "HKD"
          : /\.SS$|\.SZ$/.test(symbol)
            ? "CNY"
            : "USD",
        price: candles.at(-1)?.c ?? null,
        previousClose: candles.at(-2)?.c ?? null,
        shortName: symbol,
        longName: symbol,
        exchange: null,
        instrumentType: null,
        source: "Financial Modeling Prep",
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

async function fetchYahooSeries(
  symbol: string,
  range: string,
  interval: string,
): Promise<SeriesResult | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=${range}&interval=${interval}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
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
          indicators?: {
            quote?: {
              close?: (number | null)[];
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
            }[];
          };
        }[];
      };
    };

    const result = json.chart?.result?.[0];
    if (!result) return null;
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
    if (!candles.length) return null;
    return {
      symbol,
      currency: result.meta?.currency ?? null,
      price: result.meta?.regularMarketPrice ?? candles.at(-1)?.c ?? null,
      previousClose:
        result.meta?.chartPreviousClose ?? candles.at(-2)?.c ?? null,
      shortName: result.meta?.shortName ?? null,
      longName: result.meta?.longName ?? null,
      exchange:
        result.meta?.fullExchangeName ?? result.meta?.exchangeName ?? null,
      instrumentType: result.meta?.instrumentType ?? null,
      source: "Yahoo Finance",
      candles,
    };
  } catch {
    return null;
  }
}

/** Multi-source market data: keyless public feeds, optional free-key APIs, then cached history. */
export async function fetchSeries(
  symbol: string,
  range: string,
  interval: string,
): Promise<SeriesResult> {
  const providers = [
    () => fetchPublicSeries(symbol, range),
    () => fetchFreeKeySeries(symbol, range, interval),
    () => fetchFmpSeries(symbol, range),
    () => fetchYahooSeries(symbol, range, interval),
  ];

  for (const provider of providers) {
    const series = await provider();
    if (series?.candles.length) {
      await writeStoredSeries(symbol, range, series);
      return series;
    }
  }

  const stored = await readStoredSeries(symbol, range);
  if (stored) return { ...stored, source: stored.source ?? "数据库历史缓存" };

  const seed = getSeedSeries(symbol);
  if (seed) {
    const offline = { ...seed, source: "内置离线历史数据" };
    await writeStoredSeries(symbol, range, offline);
    return offline;
  }

  throw new Error("所有免费行情源暂时都没有返回可用数据");
}

export type DailyChange = {
  date: string;
  changePct: number | null;
  close: number;
};

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
