import { readCache, writeCache } from "./market.server";

export const SEC_UA = "HelixTrading/1.0 (research tool; contact: support@helix-trading.app)";

export type SecTickerEntry = {
  cik: string;
  ticker: string;
  name: string;
};

export async function secJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": SEC_UA, Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function secText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": SEC_UA } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** SEC 官方股票目录（代码、CIK、法定名称），缓存 7 天。 */
export async function getSecTickerCatalog(): Promise<SecTickerEntry[]> {
  const cacheKey = "sec_ticker_catalog_v2";
  let catalog: SecTickerEntry[] | null = null;
  try {
    catalog = await readCache<SecTickerEntry[]>(cacheKey);
  } catch {
    catalog = null;
  }
  if (!catalog) {
    const raw = await secJson<Record<string, { cik_str: number; ticker: string; title?: string }>>(
      "https://www.sec.gov/files/company_tickers.json",
    );
    if (!raw) return [];
    catalog = [];
    for (const row of Object.values(raw)) {
      if (!row?.ticker) continue;
      catalog.push({
        cik: String(row.cik_str).padStart(10, "0"),
        ticker: row.ticker.toUpperCase(),
        name: row.title?.trim() || row.ticker.toUpperCase(),
      });
    }
    try {
      await writeCache(cacheKey, catalog, 7 * 24 * 60 * 60);
    } catch {
      // 缓存失败不影响查询
    }
  }
  return catalog;
}

/** 代码 → CIK（SEC 官方映射表，缓存 7 天）。 */
export async function tickerToCik(ticker: string): Promise<string | null> {
  const match = (await getSecTickerCatalog()).find((row) => row.ticker === ticker.toUpperCase());
  return match?.cik ?? null;
}

export type SecCompanyProfile = {
  cik: string;
  ticker: string;
  name: string;
  exchange: string | null;
  industry: string | null;
  headquarters: string | null;
  fiscalYearEnd: string | null;
  sourceUrl: string;
};

/** SEC submissions 中的公司身份资料；新上市公司通常会先出现在这里。 */
export async function getSecCompanyProfile(ticker: string): Promise<SecCompanyProfile | null> {
  const sym = ticker.toUpperCase();
  const entry = (await getSecTickerCatalog()).find((row) => row.ticker === sym);
  if (!entry) return null;

  const cacheKey = `sec_company_profile_v1_${sym}`;
  try {
    const cached = await readCache<SecCompanyProfile>(cacheKey);
    if (cached) return cached;
  } catch {
    // 缓存不可用时继续请求 SEC。
  }

  const json = await secJson<{
    name?: string;
    tickers?: string[];
    exchanges?: string[];
    sicDescription?: string;
    fiscalYearEnd?: string;
    addresses?: { business?: { city?: string; stateOrCountryDescription?: string; country?: string } };
  }>(`https://data.sec.gov/submissions/CIK${entry.cik}.json`);

  const business = json?.addresses?.business;
  const headquarters = business
    ? [business.city, business.stateOrCountryDescription ?? business.country].filter(Boolean).join(", ") || null
    : null;
  const tickerIndex = json?.tickers?.findIndex((value) => value.toUpperCase() === sym) ?? -1;
  const exchange = tickerIndex >= 0 ? json?.exchanges?.[tickerIndex] ?? null : json?.exchanges?.[0] ?? null;
  const payload: SecCompanyProfile = {
    cik: entry.cik,
    ticker: sym,
    name: json?.name?.trim() || entry.name,
    exchange,
    industry: json?.sicDescription?.trim() || null,
    headquarters,
    fiscalYearEnd: json?.fiscalYearEnd ?? null,
    sourceUrl: `https://www.sec.gov/edgar/browse/?CIK=${entry.cik}`,
  };
  try {
    await writeCache(cacheKey, payload, 7 * 24 * 60 * 60);
  } catch {
    // 缓存失败不影响返回。
  }
  return payload;
}

export type XbrlFact = { start: string; end: string; val: number; fy: number | null; fp: string | null; filed: string | null };

/** 取某个 us-gaap 概念的季度事实（区间 80–100 天视为一个季度）。 */
export async function quarterlyConcept(cik: string, tags: string[]): Promise<XbrlFact[]> {
  for (const tag of tags) {
    const json = await secJson<{
      units?: Record<string, { start?: string; end?: string; val?: number; fy?: number; fp?: string; filed?: string }[]>;
    }>(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${tag}.json`);
    const rows = json?.units?.["USD"];
    if (!rows) continue;
    const out: XbrlFact[] = [];
    for (const r of rows) {
      if (!r.start || !r.end || typeof r.val !== "number") continue;
      const days = (new Date(r.end).getTime() - new Date(r.start).getTime()) / 86_400_000;
      if (days < 80 || days > 100) continue;
      out.push({ start: r.start, end: r.end, val: r.val, fy: r.fy ?? null, fp: r.fp ?? null, filed: r.filed ?? null });
    }
    if (out.length > 0) return out.sort((a, b) => (a.end < b.end ? 1 : -1));
  }
  return [];
}
