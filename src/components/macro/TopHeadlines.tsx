import { ExternalLink } from "lucide-react";

import type { HeadlineImpact, TopHeadline } from "@/lib/macro-briefing.types";

import { useBriefingPrefs } from "@/lib/briefing-prefs";
import { MARKET_GROUPS, matchesKeywords } from "@/lib/macro-briefing.markets";
import { formatImpactScope, resolveImpactScope } from "@/lib/macro-briefing.impact-scope";
import { symbolLabel } from "@/lib/symbol-names";
import { formatInZone } from "@/lib/time-format";
import { useTimezone } from "@/lib/timezone";


const IMPACT: Record<HeadlineImpact, { label: string; className: string }> = {
  bullish: { label: "利多", className: "bg-quote-up/15 text-quote-up border-quote-up/40" },
  bearish: { label: "利空", className: "bg-quote-down/15 text-quote-down border-quote-down/40" },
  neutral: { label: "中性", className: "bg-muted text-muted-foreground border-border" },
};

const RANK: Record<HeadlineImpact, number> = { bullish: 0, bearish: 0, neutral: 1 };

export function TopHeadlines({ data }: { data: TopHeadline[] }) {
  const { tz, shortLabel } = useTimezone();
  const { prefs } = useBriefingPrefs();
  if (data.length === 0) return <p className="text-sm text-muted-foreground">数据暂不可用</p>;

  const focusedOf = (h: TopHeadline) => {
    const text = [h.headline, ...h.affected_sectors, ...h.affected_tickers].join(" ");
    const bySector = prefs.sectors.some(
      (s) =>
        h.affected_sectors.some((x) => x.includes(s) || s.includes(x)) || h.headline.includes(s),
    );
    const byMarket = prefs.markets.some((key) => {
      const group = MARKET_GROUPS.find((g) => g.key === key);
      return group?.keywords.some((k) => text.toLowerCase().includes(k.toLowerCase())) ?? false;
    });
    return bySector || byMarket || matchesKeywords(text, prefs.keywords);
  };

  const sorted = [...data].sort(
    (a, b) =>
      Number(focusedOf(b)) - Number(focusedOf(a)) ||
      RANK[a.impact] - RANK[b.impact] ||
      b.time.localeCompare(a.time),
  );

  return (
    <ul className="space-y-3">
      <li className="text-xs leading-relaxed text-muted-foreground">
        所有发布时间已换算为{shortLabel}（数据源口径为美国东部时间）；利多＝对价格是好消息，利空＝坏消息，中性＝暂无明确方向。
      </li>

      {sorted.map((h) => {
        const tag = IMPACT[h.impact] ?? IMPACT.neutral;
        const focused = focusedOf(h);
        return (
          <li
            key={h.headline}
            className={`rounded-lg border p-3 ${
              focused ? "border-primary/50 bg-primary/5" : "border-border/60 bg-surface/50"
            }`}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              {h.url ? (
                <a
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 text-sm font-medium leading-relaxed text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {h.headline}
                </a>
              ) : (
                <p className="min-w-0 text-sm font-medium leading-relaxed text-foreground">
                  {h.headline}
                </p>
              )}
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${tag.className}`}
              >
                {tag.label}
              </span>
            </div>

            {h.headline_original ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">
                原文：{h.headline_original}
              </p>
            ) : null}

            <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              <span title={`美国东部时间 ${h.time}`}>
                {h.source} · {formatInZone(h.time, tz)} · {shortLabel}
              </span>

              {h.url ? (
                <a
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  查看原文
                  <ExternalLink aria-hidden className="size-3" />
                </a>
              ) : null}
            </p>




            {h.affected_sectors.length > 0 || h.affected_tickers.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {h.affected_sectors.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                  >
                    {s}
                  </span>
                ))}
                {h.affected_tickers.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                  >
                    {symbolLabel(t)}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{h.reasoning}</p>

            <p className="mt-1 text-xs font-medium leading-relaxed text-foreground/90">
              {formatImpactScope(resolveImpactScope(h))}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
