import { getUsEarningsForecast } from "./earnings-facts.server";
import { getEarningsFacts } from "./fundamentals.server";
import { googleNews, yahooNews, type NewsItem } from "./news.server";
import { readCache, writeCache } from "./market.server";

export type WindowEvent = {
  kind: "earnings" | "news" | "macro";
  /** ISO 时间戳；只有日期时为 YYYY-MM-DD 且 date_only = true */
  at: string;
  date_only: boolean;
  title: string;
  source: string;
  url: string | null;
  future: boolean;
};

const DAY = 86_400_000;

function toEvent(n: NewsItem, kind: WindowEvent["kind"]): WindowEvent | null {
  if (!n.publishedAt) return null;
  return {
    kind,
    at: n.publishedAt,
    date_only: false,
    title: n.title,
    source: n.source,
    url: n.url || null,
    future: new Date(n.publishedAt).getTime() > Date.now(),
  };
}

/**
 * 标的前后一个月的真实事件时间轴：财报日（Nasdaq/SEC）+ 标的相关新闻（含原文链接与发布时间）
 * + 宏观数据新闻。全部来自公开来源，不生成任何虚构条目。缓存 15 分钟。
 */
export async function getEventsWindow(input: {
  symbol: string;
  ysym: string;
  lang: "zh" | "en";
}): Promise<WindowEvent[]> {
  const cacheKey = `events_window_v1_${input.ysym}_${input.lang}`;
  try {
    const cached = await readCache<WindowEvent[]>(cacheKey);
    if (cached) return cached;
  } catch {
    /* 缓存不可用时直接取数 */
  }

  const hl = input.lang === "zh" ? "zh-CN" : "en-US";
  const query = input.symbol.replace(/\..*$/, "");
  const [forecast, facts, symNews, symNews2, macro] = await Promise.all([
    getUsEarningsForecast(query).catch(() => null),
    getEarningsFacts(input.ysym, 2).catch(() => []),
    googleNews(query, hl, 20, "1m").catch(() => []),
    yahooNews(input.ysym, 10).catch(() => []),
    googleNews(
      input.lang === "zh" ? "美联储 CPI 非农 利率决议 经济数据" : "fed CPI jobs report rate decision",
      hl,
      12,
      "1m",
    ).catch(() => []),
  ]);

  const now = Date.now();
  const events: WindowEvent[] = [];

  if (forecast?.expected_date) {
    events.push({
      kind: "earnings",
      at: forecast.expected_date,
      date_only: true,
      title: `${input.symbol} 预计发布财报${forecast.fiscal_period ? `（${forecast.fiscal_period} 季度）` : ""}`,
      source: forecast.source,
      url: forecast.source_url,
      future: new Date(forecast.expected_date).getTime() > now,
    });
  }
  for (const f of facts) {
    if (!f.report_date) continue;
    if (Math.abs(new Date(f.report_date).getTime() - now) > 31 * DAY) continue;
    events.push({
      kind: "earnings",
      at: f.report_date,
      date_only: true,
      title: `${input.symbol} 已发布财报${f.period ? `（${f.period}）` : ""}`,
      source: "Nasdaq / SEC",
      url: null,
      future: false,
    });
  }

  for (const n of [...symNews, ...symNews2]) {
    const e = toEvent(n, "news");
    if (e) events.push(e);
  }
  for (const n of macro) {
    const e = toEvent(n, "macro");
    if (e) events.push(e);
  }

  const seen = new Set<string>();
  const out = events
    .filter((e) => {
      const ts = new Date(e.at).getTime();
      if (Number.isNaN(ts) || Math.abs(ts - now) > 31 * DAY) return false;
      const k = e.title.slice(0, 60).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  try {
    await writeCache(cacheKey, out, 15 * 60);
  } catch {
    /* 忽略缓存写入失败 */
  }
  return out;
}
