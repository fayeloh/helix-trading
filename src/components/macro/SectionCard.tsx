import { ChevronDown, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DataSource } from "@/lib/macro-briefing.types";
import { cn } from "@/lib/utils";

import { SourceDetails } from "./SourceDetails";

type Props = {
  icon: LucideIcon;
  title: string;
  hint?: string;
  /** 数据时间口径，例如「数据时间：美国东部时间 08-26 收盘」。 */
  timeLabel?: string;
  /** 本次数据抓取完成时间（美国东部时间）。 */
  fetchedAt?: string | undefined;
  /** 该模块的数据来源明细。 */
  sources?: DataSource[];
  defaultOpen?: boolean;
  loading?: boolean;
  /** 数据缺失时展示「数据暂不可用」，不影响整页。 */
  unavailable?: boolean;
  children?: ReactNode;
};


export function SectionCard({
  icon: Icon,
  title,
  hint,
  timeLabel,
  fetchedAt,
  sources,
  defaultOpen = false,
  loading = false,
  unavailable = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden rounded-md border-border bg-card py-0 transition-colors hover:border-border-strong">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60 sm:px-5"
      >
        <span
          aria-hidden
          className={cn(
            "h-8 w-[2px] shrink-0 rounded-full transition-colors",
            open ? "bg-primary" : "bg-border-strong",
          )}
        />
        <Icon aria-hidden className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-tight text-foreground">
            {title}
          </span>
          {hint ? (
            <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{hint}</span>
          ) : null}
          {timeLabel ? (
            <span className="micro-label mt-0.5 block truncate">{timeLabel}</span>
          ) : null}
        </span>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-[180ms] ease-out",
            open && "rotate-180 text-primary",
          )}
        />
      </button>

      {open ? (
        <CardContent className="border-t border-border px-4 pb-4 pt-4 sm:px-5">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="skeleton-sweep h-4 w-3/4 bg-transparent" />
              <Skeleton className="skeleton-sweep h-4 w-2/3 bg-transparent" />
              <Skeleton className="skeleton-sweep h-4 w-1/2 bg-transparent" />
            </div>
          ) : unavailable ? (
            <p className="micro-label">数据暂不可用</p>
          ) : (
            children
          )}
          {loading ? null : (
            <SourceDetails fetchedAt={fetchedAt} {...(sources ? { sources } : {})} />
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

