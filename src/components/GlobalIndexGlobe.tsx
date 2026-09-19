import { useMemo } from "react";

type GlobeRow = { symbol: string; label: string; price: number | null; changePct: number | null };
const MARKERS = [
  { key: "^GSPC", left: 58, top: 39 }, { key: "^IXIC", left: 53, top: 34 },
  { key: "^HSI", left: 79, top: 51 }, { key: "000300.SS", left: 76, top: 46 },
  { key: "^N225", left: 84, top: 40 }, { key: "^GDAXI", left: 45, top: 32 },
  { key: "^FTSE", left: 42, top: 30 }, { key: "BTC-USD", left: 67, top: 62 },
];

export function GlobalIndexGlobe({ rows }: { rows: GlobeRow[] }) {
  const bySymbol = useMemo(() => new Map(rows.map((r) => [r.symbol, r])), [rows]);
  return (
    <div className="relative min-h-[330px] overflow-hidden rounded-xl border border-border/70 bg-[#07111f] p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_68%_40%,rgba(57,214,197,0.14),transparent_35%),radial-gradient(circle_at_30%_90%,rgba(121,169,255,0.12),transparent_35%)]" />
      <div className="relative z-10 flex items-center justify-between">
        <div><h2 className="text-base font-semibold text-foreground">全球指数 3D 地球</h2><p className="mt-1 text-xs text-muted-foreground">自动旋转 · 标记显示最新可验证行情</p></div>
        <span className="rounded-full border border-primary/40 px-2 py-1 text-[10px] text-primary">LIVE DATA</span>
      </div>
      <div className="relative mx-auto mt-5 size-[250px] sm:size-[285px]"><div className="helix-globe absolute inset-0 rounded-full border border-primary/40 shadow-[0_0_80px_rgba(57,214,197,0.18)]"><div className="helix-globe-grid absolute inset-[7%] rounded-full" />{MARKERS.map((m) => { const row = bySymbol.get(m.key); if (!row) return null; const positive = (row.changePct ?? 0) >= 0; return <div key={m.key} className="absolute z-20" style={{ left: `${m.left}%`, top: `${m.top}%` }} title={`${row.label} ${row.changePct == null ? "—" : `${row.changePct.toFixed(2)}%`}`}><span className={`block size-2.5 rounded-full border-2 border-[#07111f] shadow-[0_0_12px_currentColor] ${positive ? "bg-emerald-300 text-emerald-300" : "bg-rose-300 text-rose-300"}`} /></div>; })}</div></div>
      <div className="relative z-10 mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">{rows.slice(0, 6).map((r) => <span key={r.symbol}>{r.label} <b className={(r.changePct ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}>{r.changePct == null ? "—" : `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`}</b></span>)}</div>
    </div>
  );
}
