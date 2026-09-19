import { ExternalLink } from "lucide-react";

import type { Importance, MacroCalendarEvent } from "@/lib/macro-briefing.types";

import { formatInZone } from "@/lib/time-format";
import { useTimezone } from "@/lib/timezone";

import { ImpactTag } from "./ImpactTag";

const IMPORTANCE: Record<Importance, { label: string; className: string }> = {
  high: { label: "高", className: "bg-quote-down/15 text-quote-down border-quote-down/40" },
  medium: { label: "中", className: "bg-warn/15 text-warn border-warn/40" },
  low: { label: "低", className: "bg-muted text-muted-foreground border-border" },
};

export function MacroCalendar({ data }: { data: MacroCalendarEvent[] }) {
  const { tz, shortLabel } = useTimezone();
  if (data.length === 0) return <p className="text-sm text-muted-foreground">数据暂不可用</p>;

  const sorted = [...data].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-muted-foreground">
        所有时间已换算为{shortLabel}（数据源口径为美国东部时间）；事件尚未公布，方向统一标为中性（待公布）。
      </p>
      <ul className="space-y-2">
        {sorted.map((e) => {
          const tag = IMPORTANCE[e.importance] ?? IMPORTANCE.low;
          return (
            <li
              key={`${e.event}-${e.time}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/60 bg-surface/50 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{e.event}</p>
                <p className="font-mono text-xs text-muted-foreground" title={`美国东部时间 ${e.time}`}>
                  {formatInZone(e.time, tz)} · {shortLabel}
                </p>
                {e.url ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                  >
                    事件详情
                    <ExternalLink aria-hidden className="size-3" />
                  </a>
                ) : null}
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                <ImpactTag impact="neutral" suffix="待公布" />
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${tag.className}`}
                >
                  {tag.label}重要性
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
