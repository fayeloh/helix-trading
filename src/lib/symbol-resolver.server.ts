import { fetchSeries, readCache, writeCache } from "./market.server";
import { getSecCompanyProfile } from "./sec.server";

export type ResolvedSymbol = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  market: "US" | "HK" | "CN" | "CRYPTO" | "OTHER";
  type: string;
  verified: boolean;
  source: string | null;
};

export function normalizeSymbol(input: string, market: string): string {
  const value = input.trim().toUpperCase();
  if (value.includes(".") || value.includes("-") || value.startsWith("^")) return value;
  if (market === "HK") return `${value.replace(/^0+/, "").padStart(4, "0")}.HK`;
  if (market === "CN") return /^[65]/.test(value) ? `${value}.SS` : `${value}.SZ`;
  if (market === "CRYPTO") return `${value}-USD`;
  return value;
}

function marketFromSymbol(symbol: string): ResolvedSymbol["market"] {
  if (/\.HK$/i.test(symbol)) return "HK";
  if (/\.(SS|SZ)$/i.test(symbol)) return "CN";
  if (/-USD$/i.test(symbol)) return "CRYPTO";
  if (!symbol.includes(".") && !symbol.startsWith("^")) return "US";
  return "OTHER";
}

export async function resolveSymbol(input: string, market: string): Promise<ResolvedSymbol> {
  const symbol = normalizeSymbol(input, market);
  const cacheKey = `resolved_symbol_v1_${symbol}`;
  try {
    const cached = await readCache<ResolvedSymbol>(cacheKey);
    if (cached) return cached;
  } catch {
    // 缓存不可用时继续验证。
  }

  const inferredMarket = marketFromSymbol(symbol);
  const [quote, sec] = await Promise.all([
    fetchSeries(symbol, "5d", "1d").catch(() => null),
    inferredMarket === "US" ? getSecCompanyProfile(symbol).catch(() => null) : Promise.resolve(null),
  ]);
  const verified = Boolean(quote || sec);
  const result: ResolvedSymbol = {
    symbol,
    name: sec?.name ?? quote?.longName ?? quote?.shortName ?? null,
    exchange: sec?.exchange ?? quote?.exchange ?? null,
    market: inferredMarket,
    type: quote?.instrumentType === "CRYPTOCURRENCY" ? "加密" : quote?.instrumentType === "ETF" ? "ETF" : "股票",
    verified,
    source: sec && quote ? "SEC EDGAR + Yahoo Finance" : sec ? "SEC EDGAR" : quote ? "Yahoo Finance" : null,
  };
  try {
    await writeCache(cacheKey, result, verified ? 7 * 24 * 60 * 60 : 15 * 60);
  } catch {
    // 缓存失败不影响验证结果。
  }
  return result;
}