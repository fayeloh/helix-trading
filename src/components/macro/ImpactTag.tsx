export type Impact = "bullish" | "bearish" | "neutral";

const STYLES: Record<Impact, { label: string; className: string }> = {
  bullish: { label: "利多", className: "bg-quote-up/15 text-quote-up border-quote-up/40" },
  bearish: { label: "利空", className: "bg-quote-down/15 text-quote-down border-quote-down/40" },
  neutral: { label: "中性", className: "bg-muted text-muted-foreground border-border" },
};

/** 涨跌方向 → 影响判定（正常标的：上涨为利多）。 */
export function impactOf(change: number): Impact {
  if (change > 0) return "bullish";
  if (change < 0) return "bearish";
  return "neutral";
}

/** 反向指标（VIX、美元指数、债券收益率）：上行为利空。 */
export function inverseImpactOf(change: number): Impact {
  if (change > 0) return "bearish";
  if (change < 0) return "bullish";
  return "neutral";
}

export function ImpactTag({ impact, suffix }: { impact: Impact; suffix?: string }) {
  const s = STYLES[impact] ?? STYLES.neutral;
  return (
    <span
      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-semibold ${s.className}`}
    >
      {s.label}
      {suffix ? `·${suffix}` : ""}
    </span>
  );
}
