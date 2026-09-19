import { useState } from "react";

import type {
  SectorMove,
  SectorRotation as Rotation,
  SectorRotationByMarket,
} from "@/lib/macro-briefing.types";

import { useBriefingPrefs } from "@/lib/briefing-prefs";
import { matchesKeywords } from "@/lib/macro-briefing.markets";

import { ImpactTag, impactOf } from "./ImpactTag";
import { fmtPct, quoteClass } from "./quote-color";


function Group({
  title,
  items,
  focusedSectors,
  focusedKeywords,
}: {
  title: string;
  items: SectorMove[];
  focusedSectors: string[];
  focusedKeywords: string[];
}) {
  const isFocused = (name: string) =>
    focusedSectors.some((s) => name.includes(s) || s.includes(name)) ||
    matchesKeywords(name, focusedKeywords);
  const sorted = [...items].sort((a, b) => Number(isFocused(b.sector)) - Number(isFocused(a.sector)));

  return (
    <div className="rounded-lg border border-border/60 bg-surface/50 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">数据暂不可用</p>
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((s) => (
            <li key={s.sector}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {s.sector}
                  {isFocused(s.sector) ? (
                    <span className="ml-1.5 rounded bg-primary/15 px-1 py-0.5 text-xs text-primary">
                      关注
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className={`font-mono text-base font-bold ${quoteClass(s.change_pct)}`}>
                    {fmtPct(s.change_pct)}
                  </span>
                  <ImpactTag impact={impactOf(s.change_pct)} />
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const MARKET_TABS: { key: "us" | "hk"; label: string }[] = [
  { key: "us", label: "美股" },
  { key: "hk", label: "港股" },
];

export function SectorRotationPanel({
  data,
  byMarket,
}: {
  data: Rotation;
  byMarket?: SectorRotationByMarket | undefined;
}) {
  const { prefs } = useBriefingPrefs();
  const available = MARKET_TABS.filter((t) => byMarket?.[t.key]);
  const [market, setMarket] = useState<"us" | "hk">(available[0]?.key ?? "us");
  const active = byMarket?.[market] ?? data;
  const marketLabel = MARKET_TABS.find((t) => t.key === market)?.label ?? "美股";

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-muted-foreground">
        板块轮动（资金在不同行业之间的流动）：涨的一侧是钱正在进入的方向，跌的一侧是钱正在离开的方向。
      </p>

      {available.length > 1 ? (
        <div className="inline-flex rounded-sm border border-border p-0.5">
          {available.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMarket(t.key)}
              aria-pressed={market === t.key}
              className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                market === t.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Group
          title={`${marketLabel} · 领涨板块`}
          items={active.leading ?? []}
          focusedSectors={prefs.sectors}
          focusedKeywords={prefs.keywords ?? []}
        />
        <Group
          title={`${marketLabel} · 领跌板块`}
          items={active.lagging ?? []}
          focusedSectors={prefs.sectors}
          focusedKeywords={prefs.keywords ?? []}
        />
      </div>
    </div>
  );
}

