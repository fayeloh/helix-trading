import { useEffect, useMemo, useRef } from "react";

type GlobeRow = {
  symbol: string;
  label: string;
  price: number | null;
  changePct: number | null;
};
const LOCATIONS = [
  ["^GSPC", 40.71, -74.01],
  ["^IXIC", 40.71, -74.01],
  ["^DJI", 41.88, -87.63],
  ["^RUT", 41.88, -87.63],
  ["^HSI", 22.32, 114.17],
  ["^HSTECH", 22.32, 114.17],
  ["000300.SS", 31.23, 121.47],
  ["000001.SS", 31.23, 121.47],
  ["^N225", 35.68, 139.69],
  ["^KS11", 37.57, 126.98],
  ["^TWII", 25.03, 121.56],
  ["^GDAXI", 50.11, 8.68],
  ["^FTSE", 51.51, -0.13],
  ["^FCHI", 48.86, 2.35],
  ["^STOXX50E", 50.85, 4.35],
  ["BTC-USD", 1.35, 103.82],
] as const;
type GeoPoint = readonly [number, number];
type Continent = { name: string; label: GeoPoint; points: readonly GeoPoint[] };

// Simplified Natural-Earth-style coastlines. They are intentionally lightweight
// so the globe stays self-contained and renders without a map dependency.
const CONTINENTS: readonly Continent[] = [
  {
    name: "北美洲",
    label: [43, -105],
    points: [
      [72, -168],
      [70, -145],
      [63, -140],
      [58, -130],
      [52, -125],
      [49, -123],
      [45, -116],
      [40, -110],
      [32, -106],
      [25, -98],
      [20, -87],
      [25, -80],
      [32, -82],
      [38, -75],
      [46, -62],
      [54, -60],
      [60, -80],
      [68, -95],
      [72, -120],
    ],
  },
  {
    name: "南美洲",
    label: [-12, -60],
    points: [
      [12, -81],
      [5, -77],
      [-4, -80],
      [-12, -76],
      [-20, -72],
      [-28, -70],
      [-38, -65],
      [-52, -70],
      [-55, -62],
      [-45, -55],
      [-32, -50],
      [-20, -44],
      [-8, -38],
      [2, -45],
      [8, -58],
      [12, -70],
    ],
  },
  {
    name: "欧洲",
    label: [51, 15],
    points: [
      [71, -10],
      [70, 25],
      [62, 40],
      [56, 32],
      [52, 28],
      [48, 24],
      [45, 18],
      [42, 12],
      [38, 0],
      [43, -8],
      [50, -5],
      [56, -10],
      [62, -5],
    ],
  },
  {
    name: "非洲",
    label: [4, 20],
    points: [
      [36, -17],
      [35, 5],
      [32, 25],
      [28, 34],
      [20, 42],
      [10, 50],
      [0, 44],
      [-10, 40],
      [-20, 35],
      [-35, 30],
      [-35, 17],
      [-28, 8],
      [-18, 0],
      [-5, -8],
      [8, -15],
      [20, -17],
    ],
  },
  {
    name: "亚洲",
    label: [42, 88],
    points: [
      [75, 35],
      [72, 65],
      [70, 100],
      [66, 140],
      [58, 165],
      [48, 155],
      [42, 145],
      [35, 138],
      [28, 130],
      [18, 122],
      [8, 110],
      [12, 98],
      [20, 88],
      [25, 75],
      [32, 62],
      [40, 50],
      [50, 42],
      [60, 35],
    ],
  },
  {
    name: "大洋洲",
    label: [-25, 135],
    points: [
      [-10, 113],
      [-18, 120],
      [-24, 114],
      [-32, 115],
      [-38, 130],
      [-36, 145],
      [-28, 153],
      [-18, 150],
      [-12, 140],
      [-10, 128],
    ],
  },
  {
    name: "南极洲",
    label: [-78, 20],
    points: [
      [-62, -180],
      [-68, -120],
      [-72, -60],
      [-70, 0],
      [-72, 60],
      [-68, 120],
      [-62, 180],
      [-82, 180],
      [-85, 0],
      [-82, -180],
    ],
  },
];
const fmt = (v: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("en-US", { maximumFractionDigits: v >= 10000 ? 0 : 2 });

function RotatingGlobe({ rows }: { rows: GlobeRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    wrapRef = useRef<HTMLDivElement>(null),
    rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    const canvas = canvasRef.current,
      wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0,
      rotation = -2.1,
      last = performance.now();
    const resize = () => {
      const d = Math.min(devicePixelRatio || 1, 2),
        b = wrap.getBoundingClientRect();
      canvas.width = b.width * d;
      canvas.height = b.height * d;
      canvas.style.width = `${b.width}px`;
      canvas.style.height = `${b.height}px`;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const project = (
      lat: number,
      lon: number,
      cx: number,
      cy: number,
      r: number,
    ) => {
      const p = (lat * Math.PI) / 180,
        t = (lon * Math.PI) / 180 + rotation;
      return {
        x: cx + r * Math.cos(p) * Math.sin(t),
        y: cy - r * Math.sin(p),
        z: Math.cos(p) * Math.cos(t),
      };
    };
    const draw = (now: number) => {
      rotation += Math.min(40, now - last) * 0.000055;
      last = now;
      const w = wrap.clientWidth,
        h = wrap.clientHeight,
        cx = w * 0.5,
        cy = h * 0.52,
        r = Math.min(w * 0.39, h * 0.43);
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(
        cx - r * 0.2,
        cy - r * 0.25,
        r * 0.05,
        cx,
        cy,
        r * 1.2,
      );
      g.addColorStop(0, "rgba(31,101,112,.5)");
      g.addColorStop(0.62, "rgba(5,28,38,.9)");
      g.addColorStop(1, "rgba(2,10,17,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      for (let lat = -75; lat <= 75; lat += 15) {
        ctx.beginPath();
        let s = false;
        for (let lon = -180; lon <= 180; lon += 3) {
          const p = project(lat, lon, cx, cy, r);
          if (p.z < 0) {
            s = false;
            continue;
          }
          if (!s) {
            ctx.moveTo(p.x, p.y);
            s = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = "rgba(39,142,143,.14)";
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 15) {
        ctx.beginPath();
        let s = false;
        for (let lat = -90; lat <= 90; lat += 3) {
          const p = project(lat, lon, cx, cy, r);
          if (p.z < 0) {
            s = false;
            continue;
          }
          if (!s) {
            ctx.moveTo(p.x, p.y);
            s = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = "rgba(39,142,143,.11)";
        ctx.stroke();
      }
      for (const continent of CONTINENTS) {
        ctx.beginPath();
        let visible = false;
        let segments = 0;
        for (const [lat, lon] of continent.points) {
          const p = project(lat, lon, cx, cy, r);
          if (p.z < 0) {
            visible = false;
            continue;
          }
          if (!visible) {
            ctx.moveTo(p.x, p.y);
            visible = true;
            segments++;
          } else ctx.lineTo(p.x, p.y);
        }
        if (segments) {
          ctx.closePath();
          ctx.fillStyle = "rgba(45,178,132,.30)";
          ctx.strokeStyle = "rgba(93,245,178,.72)";
          ctx.lineWidth = 1.1;
          ctx.fill();
          ctx.stroke();
        }
        const lp = project(continent.label[0], continent.label[1], cx, cy, r);
        if (lp.z > 0.28) {
          ctx.font = "600 9px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = `rgba(180,255,220,${0.38 + lp.z * 0.45})`;
          ctx.fillText(continent.name, lp.x, lp.y);
        }
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(58,230,181,.24)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.04, r * 1.13, r * 0.22, -0.16, 0, Math.PI * 2);
      ctx.stroke();
      const map = new Map(rowsRef.current.map((x) => [x.symbol, x]));
      for (const [symbol, lat, lon] of LOCATIONS) {
        const row = map.get(symbol);
        if (!row) continue;
        const p = project(lat, lon, cx, cy, r);
        if (p.z < 0.08) continue;
        const hasChange =
          typeof row.changePct === "number" && Number.isFinite(row.changePct);
        const up = hasChange && row.changePct! >= 0;
        const color = !hasChange ? "#718692" : up ? "#33f39a" : "#ff5966";
        ctx.shadowColor = color;
        ctx.shadowBlur = hasChange ? 12 : 0;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        const label = `${row.label}  ${!hasChange ? "—" : `${row.changePct! >= 0 ? "+" : ""}${row.changePct!.toFixed(2)}%`}`;
        ctx.font = "10px ui-monospace, monospace";
        const tw = ctx.measureText(label).width + 12;
        let lx = p.x + 8;
        if (lx + tw > w - 5) lx = p.x - tw - 8;
        ctx.fillStyle = "rgba(5,15,23,.9)";
        ctx.strokeStyle = !hasChange
          ? "rgba(113,134,146,.45)"
          : up
            ? "rgba(51,243,154,.45)"
            : "rgba(255,89,102,.45)";
        ctx.fillRect(lx, p.y - 13, tw, 20);
        ctx.strokeRect(lx, p.y - 13, tw, 20);
        ctx.fillStyle = color;
        ctx.fillText(label, lx + 6, p.y + 1);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);
  return (
    <div
      ref={wrapRef}
      className="relative h-[390px] overflow-hidden rounded-lg border border-[#16313b] bg-[radial-gradient(circle_at_48%_45%,rgba(39,112,117,.16),transparent_55%)]"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 flex gap-3 text-[10px] text-[#7d989e]">
        <span>
          <i className="mr-1 inline-block size-2 rounded-full bg-[#33f39a]" />
          上涨
        </span>
        <span>
          <i className="mr-1 inline-block size-2 rounded-full bg-[#ff4d5e]" />
          下跌
        </span>
        <span>
          <i className="mr-1 inline-block size-2 rounded-full bg-[#718692]" />
          暂无数据
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-[#6d8991]">
        全球经纬度定位 · 自动 3D 旋转 · 每 60 秒更新
      </div>
    </div>
  );
}

export function GlobalIndexGlobe({ rows }: { rows: GlobeRow[] }) {
  // Keep the core list stable even when a provider has no quote. A missing
  // quote should be visible as “暂无数据”, not silently remove the index.
  const core = useMemo(() => rows.slice(0, 7), [rows]);
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#1d3445] bg-[#071019] text-[#d8f7ef]">
      <div className="relative border-b border-[#1d3445] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="size-2 rounded-full bg-[#33f39a] shadow-[0_0_10px_#33f39a]" />
          全球指数地球仪
        </div>
        <p className="mt-1 text-[10px] text-[#6d8991]">
          ROTATING 3D GLOBE · GLOBAL INDEX MONITOR
        </p>
      </div>
      <div className="relative grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_250px]">
        <RotatingGlobe rows={rows} />
        <div className="rounded-lg border border-[#192c3c] bg-[#0d1424] px-3 py-3">
          <div className="mb-3 text-[11px] tracking-[.18em] text-[#718692]">
            核心指数
          </div>
          {core.map((r) => {
            const hasChange =
              typeof r.changePct === "number" && Number.isFinite(r.changePct);
            const up = hasChange && r.changePct! >= 0;
            return (
              <div
                key={r.symbol}
                className="border-b border-[#203040] py-3 last:border-0"
              >
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-[#c6d7dc]">{r.label}</span>
                  <b
                    className={`tabular text-xs ${!hasChange ? "text-[#718692]" : up ? "text-[#33f39a]" : "text-[#ff5966]"}`}
                  >
                    {fmt(r.price)}
                  </b>
                </div>
                <div
                  className={`mt-1 text-right text-[10px] ${!hasChange ? "text-[#718692]" : up ? "text-[#33f39a]" : "text-[#ff5966]"}`}
                >
                  {!hasChange
                    ? "暂无数据"
                    : `${r.changePct! >= 0 ? "+" : ""}${r.changePct!.toFixed(2)}%`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
