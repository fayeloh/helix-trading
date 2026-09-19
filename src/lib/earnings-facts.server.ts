import { readCache, writeCache } from "./market.server";
import { quarterlyConcept, tickerToCik } from "./sec.server";
export type EarningsFact = {
  period: string | null;
  report_date: string | null;
  timing: "before_open" | "after_close" | "unknown";
  revenue_actual: number | null;
  revenue_estimate: number | null;
  net_income_actual: number | null;
  eps_actual: number | null;
  eps_estimate: number | null;
  currency: string | null;
  revenue_yoy_pct?: number | null;
  net_income_yoy_pct?: number | null;
  revenue_surprise_pct?: number | null;
};

/** Nasdaq 公开的 EPS 实际 / 一致预期表（免密钥）。 */
type SurpriseRow = {
  fiscalQtrEnd?: string;
  dateReported?: string;
  eps?: number | string;
  consensusForecast?: number | string;
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isoDate(us: string | undefined): string | null {
  if (!us) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(us.trim());
  if (!m) return null;
  return `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
}

/** "Jun 2026" → 该季度结束日期（近似取月末）。 */
function qtrEnd(label: string | undefined): string | null {
  if (!label) return null;
  const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(label.trim());
  if (!m) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mi = months.indexOf(m[1]!);
  if (mi < 0) return null;
  const d = new Date(Date.UTC(Number(m[2]), mi + 1, 0));
  return d.toISOString().slice(0, 10);
}

async function nasdaqSurprises(ticker: string): Promise<SurpriseRow[]> {
  try {
    const res = await fetch(`https://api.nasdaq.com/api/company/${encodeURIComponent(ticker)}/earnings-surprise`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { earningsSurpriseTable?: { rows?: SurpriseRow[] } } };
    return json.data?.earningsSurpriseTable?.rows ?? [];
  } catch {
    return [];
  }
}

/**
 * 美股财报硬数据：EPS 实际/一致预期来自 Nasdaq，营收与净利润来自 SEC XBRL 申报。
 * 任一字段拿不到就返回 null，绝不推测。免密钥，结果缓存 12 小时。
 */
export async function getUsEarningsFacts(ticker: string, limit = 3): Promise<EarningsFact[]> {
  const sym = ticker.replace(/\..*$/, "").toUpperCase();
  const cacheKey = `earn_facts_v1_${sym}_${limit}`;
  try {
    const cached = await readCache<EarningsFact[]>(cacheKey);
    if (cached) return cached;
  } catch {
    // 缓存不可用时直接取数
  }

  const cik = await tickerToCik(sym);
  const [rows, revenue, netIncome] = await Promise.all([
    nasdaqSurprises(sym),
    cik
      ? quarterlyConcept(cik, [
          "RevenueFromContractWithCustomerExcludingAssessedTax",
          "Revenues",
          "RevenueFromContractWithCustomerIncludingAssessedTax",
        ])
      : Promise.resolve([]),
    cik ? quarterlyConcept(cik, ["NetIncomeLoss", "ProfitLoss"]) : Promise.resolve([]),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const past = rows
    .map((r) => ({ r, reported: isoDate(r.dateReported), end: qtrEnd(r.fiscalQtrEnd) }))
    .filter((x) => x.reported && x.reported <= today)
    .sort((a, b) => (a.reported! < b.reported! ? 1 : -1))
    .slice(0, limit);

  const near = (list: { end: string; val: number }[], end: string | null) => {
    if (!end) return null;
    const t = new Date(end).getTime();
    let best: { end: string; val: number } | null = null;
    for (const f of list) {
      const diff = Math.abs(new Date(f.end).getTime() - t);
      if (diff <= 20 * 86_400_000 && (!best || diff < Math.abs(new Date(best.end).getTime() - t))) best = f;
    }
    return best?.val ?? null;
  };

  const yoy = (list: { end: string; val: number }[], end: string | null, value: number | null) => {
    if (!end || value == null) return null;
    const prior = list.find((f) => {
      const diff = Math.abs(new Date(f.end).getTime() - new Date(end).getTime());
      return diff > 330 * 86_400_000 && diff < 430 * 86_400_000;
    });
    return prior?.val ? ((value - prior.val) / Math.abs(prior.val)) * 100 : null;
  };
  const facts: EarningsFact[] = past.map(({ r, reported, end }) => {
    const revenueActual = near(revenue, end);
    const netIncomeActual = near(netIncome, end);
    return ({
    period: r.fiscalQtrEnd ?? reported ?? null,
    report_date: reported,
    timing: "unknown",
    revenue_actual: revenueActual,
    revenue_estimate: null,
    net_income_actual: netIncomeActual,
    eps_actual: num(r.eps),
    eps_estimate: num(r.consensusForecast),
    currency: revenue.length > 0 ? "USD" : null,
    revenue_yoy_pct: yoy(revenue, end, revenueActual),
    net_income_yoy_pct: yoy(netIncome, end, netIncomeActual),
    revenue_surprise_pct: null,
  });
  });

  if (facts.length > 0) {
    try {
      await writeCache(cacheKey, facts, 12 * 60 * 60);
    } catch {
      // 缓存写入失败不影响返回
    }
  }
  return facts;
}

export type EarningsForecast = {
  fiscal_period: string | null;
  expected_date: string | null;
  timing: "before_open" | "after_close" | "unknown";
  consensus_eps: number | null;
  high_eps: number | null;
  low_eps: number | null;
  estimates_count: number | null;
  revisions_up: number | null;
  revisions_down: number | null;
  consensus_revenue: string | null;
  source: string;
  source_url: string;
  as_of: string;
};

type ForecastRow = {
  fiscalEnd?: string;
  consensusEPSForecast?: number | string;
  highEPSForecast?: number | string;
  lowEPSForecast?: number | string;
  noOfEstimates?: number | string;
  up?: number | string;
  down?: number | string;
};

/**
 * 下一次财报的前瞻一致预期（Nasdaq 免密钥）：一致 EPS、高低区间、分析师家数、近 4 周上下调次数。
 * 拿不到就返回 null，禁止推测。缓存 12 小时。
 */
export async function getUsEarningsForecast(ticker: string): Promise<EarningsForecast | null> {
  const sym = ticker.replace(/\..*$/, "").toUpperCase();
  const cacheKey = `earn_forecast_v1_${sym}`;
  try {
    const cached = await readCache<EarningsForecast>(cacheKey);
    if (cached) return cached;
  } catch {
    // 缓存不可用时直接取数
  }

  let row: ForecastRow | undefined;
  try {
    const res = await fetch(
      `https://api.nasdaq.com/api/analyst/${encodeURIComponent(sym)}/earnings-forecast`,
      { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { quarterlyForecast?: { rows?: ForecastRow[] } };
    };
    row = json.data?.quarterlyForecast?.rows?.[0];
  } catch {
    return null;
  }
  if (!row) return null;

  let expected: string | null = null;
  try {
    const res = await fetch(
      `https://api.nasdaq.com/api/analyst/${encodeURIComponent(sym)}/earnings-date`,
      { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } },
    );
    if (res.ok) {
      const json = (await res.json()) as { data?: { announcement?: string } };
      const m = /([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/.exec(json.data?.announcement ?? "");
      if (m) {
        const d = new Date(`${m[1]} UTC`);
        if (!Number.isNaN(d.getTime())) expected = d.toISOString().slice(0, 10);
      }
    }
  } catch {
    // 预计日期拿不到就留 null
  }

  const payload: EarningsForecast = {
    fiscal_period: row.fiscalEnd ?? null,
    expected_date: expected,
    timing: "unknown",
    consensus_eps: num(row.consensusEPSForecast),
    high_eps: num(row.highEPSForecast),
    low_eps: num(row.lowEPSForecast),
    estimates_count: num(row.noOfEstimates),
    revisions_up: num(row.up),
    revisions_down: num(row.down),
    consensus_revenue: null,
    source: "Nasdaq 分析师一致预期",
    source_url: `https://www.nasdaq.com/market-activity/stocks/${sym.toLowerCase()}/earnings`,
    as_of: new Date().toISOString(),
  };

  try {
    await writeCache(cacheKey, payload, 12 * 60 * 60);
  } catch {
    // 缓存写入失败不影响返回
  }
  return payload;
}
