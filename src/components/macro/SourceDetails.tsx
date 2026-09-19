import { ChevronDown, Database, ExternalLink } from "lucide-react";
import { useState } from "react";

import type { DataSource } from "@/lib/macro-briefing.types";
import { cn } from "@/lib/utils";

import { formatFullInZone } from "@/lib/time-format";
import { useTimezone } from "@/lib/timezone";

/** 「数据抓取时间 + 来源明细」折叠区，放在每个模块卡片底部。 */
export function SourceDetails({
  fetchedAt,
  sources = [],
}: {
  /** 本次抓取完成时间（美国东部时间）。 */
  fetchedAt?: string | undefined;
  sources?: DataSource[];
}) {
  const [open, setOpen] = useState(false);
  const { tz, shortLabel } = useTimezone();
  if (!fetchedAt && sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/60 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-surface/60"
      >
        <Database aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          数据抓取时间：{fetchedAt ? formatFullInZone(fetchedAt, tz) : "—"} · {shortLabel}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {sources.length > 0 ? `${sources.length} 个来源` : "来源明细"}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        sources.length === 0 ? (
          <p className="px-1 pt-2 text-xs text-muted-foreground">来源明细暂不可用</p>
        ) : (
          <ul className="space-y-1.5 px-1 pt-2">
            {sources.map((s) => (
              <li
                key={`${s.name}-${s.updated_at}`}
                className="rounded-md border border-border/60 bg-surface/50 px-2.5 py-2"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {s.name}
                      <ExternalLink aria-hidden className="size-3" />
                    </a>
                  ) : (
                    <span className="text-xs font-medium text-foreground">{s.name}</span>
                  )}
                  {s.covers ? (
                    <span className="text-xs text-muted-foreground">{s.covers}</span>
                  ) : null}
                </div>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  来源更新时间：{formatFullInZone(s.updated_at, tz)} · {shortLabel}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
