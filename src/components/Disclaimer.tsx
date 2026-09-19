import { ShieldAlert } from "lucide-react";

import { DISCLAIMER } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function DisclaimerBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
      <p>{DISCLAIMER}</p>
    </div>
  );
}

export function KindBadge({
  kind,
  confidence,
}: {
  kind?: string | null;
  confidence?: string | null;
}) {
  if (!kind) return null;
  const isFact = kind === "fact";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        isFact
          ? "border-bull/40 bg-bull-muted/40 text-bull"
          : "border-warn/40 bg-warn/10 text-warn",
      )}
    >
      {isFact ? "事实" : "推演"}
      {confidence ? <span className="opacity-70">· {confidence}</span> : null}
    </span>
  );
}

export function SourceNote({
  source,
  asOf,
}: {
  source?: string | null;
  asOf?: string | null;
}) {
  if (!source && !asOf) return null;
  return (
    <span className="text-[11px] text-muted-foreground">
      来源：{source ?? "未提供"}
      {asOf ? ` · 数据时间：${asOf}` : ""}
    </span>
  );
}
