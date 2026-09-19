import { readCache, writeCache } from "./market.server";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export type NewsItem = {
  title: string;
  source: string;
  publishedAt: string | null;
  url: string;
  related?: string[];
};

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** Google News RSS — free, no API key,每条含 pubDate 与来源 [默认方案，可调整] */
export async function googleNews(
  query: string,
  hl: string,
  limit: number,
  when = "1d",
): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${query} when:${when}`,
  )}&hl=${hl}&gl=${hl.startsWith("zh") ? "CN" : "US"}&ceid=${hl.startsWith("zh") ? "CN:zh-Hans" : "US:en"}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = xml.split("<item>").slice(1, limit + 1);
  return items
    .map((raw): NewsItem | null => {
      const title = decodeEntities(raw.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      if (!title) return null;
      const link = decodeEntities(raw.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
      const pub = raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
      const source = decodeEntities(raw.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "Google News");
      const ts = pub ? new Date(pub) : null;
      return {
        title,
        source,
        publishedAt: ts && !Number.isNaN(ts.getTime()) ? ts.toISOString() : null,
        url: link,
      };
    })
    .filter((x): x is NewsItem => !!x);
}

/**
 * 通用 RSS 解析（CNBC / Investing.com / Yahoo Finance 等）。
 * 云端 Worker 环境下 Google News 常被拦截，这些源是主力。
 */
export async function rssFeed(
  url: string,
  sourceName: string,
  limit: number,
): Promise<NewsItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml,*/*" } });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = xml.split(/<item[\s>]/).slice(1, limit + 1);
  return items
    .map((raw): NewsItem | null => {
      const title = decodeEntities(raw.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      if (!title) return null;
      const link = decodeEntities(raw.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
      const pub =
        raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ??
        raw.match(/<dc:date>([\s\S]*?)<\/dc:date>/)?.[1];
      const ts = pub ? new Date(pub) : null;
      return {
        title,
        source: decodeEntities(raw.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "") || sourceName,
        publishedAt: ts && !Number.isNaN(ts.getTime()) ? ts.toISOString() : null,
        url: link,
      };
    })
    .filter((x): x is NewsItem => !!x);
}


/** Yahoo Finance search — 返回与标的直接关联的新闻，含 providerPublishTime */
export async function yahooNews(query: string, limit: number): Promise<NewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    query,
  )}&quotesCount=0&newsCount=${limit}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    news?: {
      title?: string;
      publisher?: string;
      link?: string;
      providerPublishTime?: number;
      relatedTickers?: string[];
    }[];
  };
  return (json.news ?? [])
    .filter((n) => n.title)
    .map((n) => ({
      title: n.title!,
      source: n.publisher ?? "Yahoo Finance",
      publishedAt: n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toISOString()
        : null,
      url: n.link ?? "",
      related: n.relatedTickers ?? [],
    }));
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "").slice(0, 60);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export type NewsBundle = {
  fetchedAt: string;
  headlines: NewsItem[];
  econ: NewsItem[];
  earnings: NewsItem[];
  holdings: NewsItem[];
};

async function safe(p: Promise<NewsItem[]>): Promise<NewsItem[]> {
  try {
    return await p;
  } catch {
    return [];
  }
}

/** 当日宏观素材：头条 + 经济数据/央行 + 财报日历。缓存 5 分钟以控成本。 */
export async function fetchMacroNews(lang: "zh" | "en"): Promise<NewsBundle> {
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const cacheKey = `news_macro_${lang}_${bucket}`;
  const cached = await readCache<NewsBundle>(cacheKey);
  if (cached) return cached;

  const hl = lang === "zh" ? "zh-CN" : "en-US";
  const [h1, h2, h3, e1, e2, r1] = await Promise.all([
    safe(googleNews(lang === "zh" ? "股市 美股 财经 头条" : "stock market today", hl, 12)),
    safe(googleNews(lang === "zh" ? "港股 恒生指数 A股" : "hong kong stocks china markets", hl, 8)),
    safe(googleNews(lang === "zh" ? "比特币 加密货币" : "bitcoin crypto market", hl, 6)),
    safe(googleNews(lang === "zh" ? "美联储 CPI 非农 经济数据 公布" : "fed CPI jobs report economic data release", hl, 10)),
    safe(googleNews(lang === "zh" ? "关税 政策 地缘 市场影响" : "tariffs policy geopolitics markets", hl, 6)),
    safe(googleNews(lang === "zh" ? "财报 发布 业绩" : "earnings report today before open after close", hl, 10)),
  ]);

  const bundle: NewsBundle = {
    fetchedAt: new Date().toISOString(),
    headlines: dedupe([...h1, ...h2, ...h3]).slice(0, 24),
    econ: dedupe([...e1, ...e2]).slice(0, 14),
    earnings: dedupe(r1).slice(0, 12),
    holdings: [],
  };
  await writeCache(cacheKey, bundle, 5 * 60);
  return bundle;
}

/** 持仓相关素材：逐标的取 Yahoo 新闻（与代码强关联），最多 12 个标的。 */
export async function fetchHoldingsNews(symbols: string[], lang: "zh" | "en"): Promise<NewsBundle> {
  const list = symbols.slice(0, 12);
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const cacheKey = `news_holdings_${lang}_${bucket}_${list.join(",")}`;
  const cached = await readCache<NewsBundle>(cacheKey);
  if (cached) return cached;

  const macro = await fetchMacroNews(lang);
  const per = await Promise.all(list.map((s) => safe(yahooNews(s, 5))));
  const bundle: NewsBundle = {
    ...macro,
    holdings: dedupe(per.flat()).slice(0, 30),
  };
  await writeCache(cacheKey, bundle, 5 * 60);
  return bundle;
}

export function renderNews(items: NewsItem[], timezone: string): string {
  if (items.length === 0) return "（未检索到条目）";
  return items
    .map((n) => {
      const t = n.publishedAt
        ? new Date(n.publishedAt).toLocaleString("sv-SE", { timeZone: timezone })
        : "unknown";
      const rel = n.related?.length ? ` [关联: ${n.related.join(",")}]` : "";
      return `- [${t}] ${n.title}（来源：${n.source}）${rel}`;
    })
    .join("\n");
}
