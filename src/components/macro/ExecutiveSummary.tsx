import { ExternalLink } from "lucide-react";

import { useBriefingPrefs } from "@/lib/briefing-prefs";
import { buildExecutiveSummary } from "@/lib/macro-briefing.summarize";
import type { MacroBriefing } from "@/lib/macro-briefing.types";
import { formatInZone } from "@/lib/time-format";
import { useTimezone } from "@/lib/timezone";

import { ImpactTag } from "./ImpactTag";

export function ExecutiveSummary({ data }: { data: MacroBriefing }) {
  const { prefs } = useBriefingPrefs();
  const { tz, shortLabel } = useTimezone();
  const { paragraph, headlines, terms, disclaimer } = buildExecutiveSummary(data, undefined, prefs);

  if (!paragraph) return <p className="text-sm text-muted-foreground">数据暂不可用</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-foreground [text-indent:2em]">{paragraph}</p>

      {headlines.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">值得关注的新闻</h3>
          <ol className="space-y-2.5">
            {headlines.map((h, i) => (
              <li
                key={h.headline}
                className={`rounded-lg border p-2.5 ${
                  h.focused ? "border-primary/50 bg-primary/5" : "border-border/60 bg-surface/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-medium text-foreground">
                    {i + 1}.{" "}
                    {h.url ? (
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-4 hover:underline"
                      >
                        {h.headline}
                        <ExternalLink className="ml-1 inline h-3 w-3 align-[-1px]" />
                      </a>
                    ) : (
                      h.headline
                    )}
                  </p>
                  <ImpactTag impact={h.impact} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  解读：{h.note}
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-foreground/90">
                  {h.scope}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/80">
                  {h.source} · {formatInZone(h.time, tz)}（{shortLabel}）
                  {h.focused ? " · 命中你的关注" : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {terms.length > 0 ? (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold text-foreground">名词直译</h3>
          <dl className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            {terms.map((t) => (
              <div key={t.term}>
                <dt className="inline font-medium text-foreground">{t.term}：</dt>
                <dd className="inline"> {t.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">{disclaimer}</p>
    </div>
  );
}
