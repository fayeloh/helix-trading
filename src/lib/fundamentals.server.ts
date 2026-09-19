import { getUsEarningsFacts, type EarningsFact } from "./earnings-facts.server";
import { fetchSeries } from "./market.server";
import { readCache, writeCache } from "./market.server";
import { getSecCompanyProfile } from "./sec.server";

export type { EarningsFact };

const STABLE = "https://financialmodelingprep.com/stable";
const LEGACY = "https://financialmodelingprep.com/api/v3";

export type CompanyProfileData = {
  name: string | null;
  exchange: string | null;
  symbol: string;
  sector: string | null;
  industry: string | null;
  founded: string | null;
  headquarters: string | null;
  employees: number | null;
  marketCap: number | null;
  website: string | null;
  currency: string | null;
  description: string | null;
  source: string;
  as_of: string;
} | null;

type FmpProfile = {
  companyName?: string;
  exchangeShortName?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  ipoDate?: string;
  city?: string;
  state?: string;
  country?: string;
  fullTimeEmployees?: string | number;
  mktCap?: number;
  marketCap?: number;
  website?: string;
  currency?: string;
  description?: string;
};

function key(): string | null {
  return process.env["FMP_API_KEY"] ?? null;
}

/** FMP moved to /stable endpoints; legacy /api/v3 still serves older keys. Try both. */
async function fmp<T>(stablePath: string, legacyPath: string): Promise<T | null> {
  const apiKey = key();
  if (!apiKey) return null;
  for (const url of [`${STABLE}${stablePath}`, `${LEGACY}${legacyPath}`]) {
    try {
      const full = `${url}${url.includes("?") ? "&" : "?"}apikey=${apiKey}`;
      const res = await fetch(full, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      if (json && typeof json === "object" && "Error Message" in (json as object)) continue;
      if (Array.isArray(json) && json.length === 0) continue;
      return json as T;
    } catch {
      // try next base
    }
  }
  return null;
}

export async function getCompanyProfile(ysym: string): Promise<CompanyProfileData> {
  const cacheKey = `company_profile_v2_${ysym}`;
  const cached = await readCache<CompanyProfileData>(cacheKey);
  if (cached !== null) return cached;

  const sym = encodeURIComponent(ysym);
  const isUs = !/\.[A-Z]{2}$/i.test(ysym) && !/-USD$/i.test(ysym) && !ysym.startsWith("^");
  const [rows, sec, quote] = await Promise.all([
    fmp<FmpProfile[]>(`/profile?symbol=${sym}`, `/profile/${sym}`),
    isUs ? getSecCompanyProfile(ysym).catch(() => null) : Promise.resolve(null),
    fetchSeries(ysym, "5d", "1d").catch(() => null),
  ]);

  const r = rows?.[0];
  if (!r && !sec && !quote) return null;

  const hq = r ? [r.city, r.state, r.country].filter(Boolean).join(", ") || null : null;
  const sources = [sec ? "SEC EDGAR submissions" : null, quote ? "Yahoo Finance chart metadata" : null, r ? "Financial Modeling Prep /profile" : null].filter(Boolean);
  const payload: CompanyProfileData = {
    name: sec?.name ?? r?.companyName ?? quote?.longName ?? quote?.shortName ?? null,
    exchange: sec?.exchange ?? r?.exchangeShortName ?? r?.exchange ?? quote?.exchange ?? null,
    symbol: ysym,
    sector: r?.sector ?? null,
    industry: sec?.industry ?? r?.industry ?? null,
    founded: r?.ipoDate ?? null,
    headquarters: sec?.headquarters ?? hq,
    employees: r?.fullTimeEmployees ? Number(r.fullTimeEmployees) || null : null,
    marketCap: r?.marketCap ?? r?.mktCap ?? null,
    website: r?.website ?? sec?.sourceUrl ?? null,
    currency: r?.currency ?? quote?.currency ?? null,
    description: r?.description ?? null,
    source: sources.join(" + ") || "公开市场数据",
    as_of: new Date().toISOString().slice(0, 10),
  };
  await writeCache(cacheKey, payload, payload.name ? 60 * 60 * 24 * 7 : 30 * 60);
  return payload;
}

async function getFmpEarningsFacts(ysym: string, limit = 3): Promise<EarningsFact[]> {
  const cacheKey = `fmp_earnings_${ysym}_${limit}`;
  const cached = await readCache<EarningsFact[]>(cacheKey);
  if (cached) return cached;

  const sym = encodeURIComponent(ysym);
  const [calendar, income] = await Promise.all([
    fmp<
      {
        date?: string;
        time?: string;
        epsActual?: number | null;
        epsEstimated?: number | null;
        eps?: number | null;
        revenueActual?: number | null;
        revenueEstimated?: number | null;
        revenue?: number | null;
      }[]
    >(`/earnings?symbol=${sym}&limit=24`, `/historical/earning_calendar/${sym}?limit=24`),
    fmp<
      {
        date?: string;
        period?: string;
        calendarYear?: string;
        fiscalYear?: string;
        revenue?: number;
        netIncome?: number;
        reportedCurrency?: string;
      }[]
    >(`/income-statement?symbol=${sym}&period=quarter&limit=8`, `/income-statement/${sym}?period=quarter&limit=8`),
  ]);

  if (!calendar && !income) return [];

  const today = new Date().toISOString().slice(0, 10);
  const past = (calendar ?? [])
    .filter((c) => c.date && c.date <= today)
    .sort((a, b) => (a.date! < b.date! ? 1 : -1))
    .slice(0, limit);

  const facts: EarningsFact[] = past.map((c) => {
    const stmt = (income ?? []).find((s) => {
      if (!s.date || !c.date) return false;
      const diff = Math.abs(new Date(s.date).getTime() - new Date(c.date).getTime());
      return diff < 1000 * 60 * 60 * 24 * 75;
    });
    const fy = stmt?.calendarYear ?? stmt?.fiscalYear;
    return {
      period: stmt?.period && fy ? `${fy} ${stmt.period}` : (c.date ?? null),
      report_date: c.date ?? null,
      timing: c.time === "bmo" ? "before_open" : c.time === "amc" ? "after_close" : "unknown",
      revenue_actual: c.revenueActual ?? c.revenue ?? stmt?.revenue ?? null,
      revenue_estimate: c.revenueEstimated ?? null,
      net_income_actual: stmt?.netIncome ?? null,
      eps_actual: c.epsActual ?? c.eps ?? null,
      eps_estimate: c.epsEstimated ?? null,
      currency: stmt?.reportedCurrency ?? null,
    };
  });

  await writeCache(cacheKey, facts, 60 * 60 * 12);
  return facts;
}

export function hasFundamentalsSource(): boolean {
  return key() !== null;
}

/**
 * 财报硬数据：美股优先走免密钥的 Nasdaq + SEC 申报，缺失字段再用 FMP（若配置了 key）补齐。
 * 其他市场只能依赖 FMP；都取不到时返回空数组，由上层显示数据缺口。
 */
export async function getEarningsFacts(ysym: string, limit = 3): Promise<EarningsFact[]> {
  const isUs = !/\.[A-Z]{2}$/i.test(ysym) && !/-USD$/i.test(ysym);
  const primary = isUs ? await getUsEarningsFacts(ysym, limit) : [];
  const fallback = hasFundamentalsSource() ? await getFmpEarningsFacts(ysym, limit) : [];
  if (primary.length === 0) return fallback;
  if (fallback.length === 0) return primary;

  return primary.map((f) => {
    const match = fallback.find(
      (b) =>
        b.report_date &&
        f.report_date &&
        Math.abs(new Date(b.report_date).getTime() - new Date(f.report_date).getTime()) < 10 * 86_400_000,
    );
    if (!match) return f;
    return {
      ...f,
      timing: f.timing === "unknown" ? match.timing : f.timing,
      revenue_actual: f.revenue_actual ?? match.revenue_actual,
      revenue_estimate: f.revenue_estimate ?? match.revenue_estimate,
      net_income_actual: f.net_income_actual ?? match.net_income_actual,
      eps_actual: f.eps_actual ?? match.eps_actual,
      eps_estimate: f.eps_estimate ?? match.eps_estimate,
      currency: f.currency ?? match.currency,
    };
  });
}
