import { useEffect, useMemo, useRef } from "react";

type GlobeRow = {
  symbol: string;
  label: string;
  price: number | null;
  changePct: number | null;
  history?: number[];
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

const pointInContinent = (
  lat: number,
  lon: number,
  points: readonly GeoPoint[],
) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [yi, xi] = points[i]!;
    const [yj, xj] = points[j]!;
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

// A deterministic point cloud gives the globe the same illuminated-data-mesh
// look as the reference video without shipping a large texture or map runtime.
const LAND_DOTS = CONTINENTS.flatMap((continent, continentIndex) => {
  const dots: { lat: number; lon: number; seed: number }[] = [];
  for (let lat = -84; lat <= 78; lat += 1.35) {
    for (let lon = -177; lon <= 177; lon += 1.65) {
      const seed = Math.abs(
        Math.sin(lat * 12.9898 + lon * 78.233 + continentIndex * 17.17),
      );
      const jitterLat = (seed - 0.5) * 0.82;
      const jitterLon = (Math.abs(Math.sin(seed * 43758.5453)) - 0.5) * 0.96;
      if (
        pointInContinent(lat + jitterLat, lon + jitterLon, continent.points)
      ) {
        dots.push({ lat: lat + jitterLat, lon: lon + jitterLon, seed });
      }
    }
  }
  return dots;
});

const fmt = (v: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("en-US", { maximumFractionDigits: v >= 10000 ? 0 : 2 });

function MiniSparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.0001);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - ((value - min) / span) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = positive ? "#33f39a" : "#ff5966";
  return (
    <svg viewBox="0 0 100 30" className="mt-1 h-7 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      <circle cx={points.split(" ").at(-1)?.split(",")[0]} cy={points.split(" ").at(-1)?.split(",")[1]} r="1.8" fill={color} />
    </svg>
  );
}

const STARS = Array.from({ length: 180 }, (_, i) => ({
  x: ((i * 73) % 997) / 997,
  y: ((i * 151 + 31) % 991) / 991,
  r: 0.35 + ((i * 17) % 10) / 18,
  a: 0.18 + ((i * 29) % 7) / 16,
}));
const HUBS: readonly [number, number][] = [
  [40.71, -74],
  [51.51, -0.13],
  [50.11, 8.68],
  [35.68, 139.69],
  [31.23, 121.47],
  [22.32, 114.17],
  [1.35, 103.82],
  [-33.87, 151.21],
];
const HUB_LINKS: readonly [number, number][] = [
  [0, 1],
  [1, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [1, 2],
  [0, 4],
  [2, 6],
];

// Sparse, deterministic city-light points keep the night side alive without
// shipping a multi-megabyte earth texture.
const CITY_LIGHTS = Array.from({ length: 115 }, (_, i) => ({
  lat: -52 + ((i * 37) % 104) + Math.sin(i * 1.7) * 5,
  lon: -178 + ((i * 83) % 356) + Math.cos(i * 2.1) * 5,
  size: 0.35 + (i % 4) * 0.16,
}));

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
      tilt = 0.14,
      last = performance.now(),
      autoRotate = true,
      dragging = false,
      dragX = 0,
      dragY = 0,
      pointerInside = false,
      resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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
        t = (lon * Math.PI) / 180 + rotation,
        rawX = Math.cos(p) * Math.sin(t),
        rawY = Math.sin(p),
        rawZ = Math.cos(p) * Math.cos(t),
        cosTilt = Math.cos(tilt),
        sinTilt = Math.sin(tilt),
        y = rawY * cosTilt - rawZ * sinTilt,
        z = rawY * sinTilt + rawZ * cosTilt;
      return {
        x: cx + r * rawX,
        y: cy - r * y,
        z,
      };
    };
    const draw = (now: number) => {
      if (autoRotate && !reducedMotion.matches) {
        rotation += Math.min(40, now - last) * 0.000055;
      }
      last = now;
      const w = wrap.clientWidth,
        h = wrap.clientHeight,
        cx = w * 0.5,
        cy = h * 0.51,
        r = Math.min(w * 0.435, h * 0.46);
      ctx.clearRect(0, 0, w, h);
      for (const star of STARS) {
        const shimmer = reducedMotion.matches
          ? 0.7
          : 0.58 + Math.sin(now * 0.0008 + star.x * 19) * 0.16;
        ctx.fillStyle = `rgba(99,157,169,${star.a * shimmer})`;
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      const g = ctx.createRadialGradient(
        cx - r * 0.2,
        cy - r * 0.25,
        r * 0.05,
        cx,
        cy,
        r * 1.2,
      );
      g.addColorStop(0, "rgba(17,58,67,.36)");
      g.addColorStop(0.62, "rgba(4,20,27,.84)");
      g.addColorStop(1, "rgba(2,10,17,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.setLineDash([2, 7]);
      ctx.lineDashOffset = reducedMotion.matches ? 0 : -now * 0.008;
      ctx.strokeStyle = "rgba(57,255,136,.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.04, r * 1.28, r * 0.25, -0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(63,216,255,.08)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.04, r * 1.42, r * 0.3, -0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      // Deep ocean base + soft solar reflection: this gives the mesh a
      // spherical material response instead of a flat map-on-black look.
      const ocean = ctx.createRadialGradient(
        cx - r * 0.32,
        cy - r * 0.38,
        r * 0.08,
        cx + r * 0.12,
        cy + r * 0.08,
        r * 1.05,
      );
      ocean.addColorStop(0, "rgba(31,105,118,.78)");
      ocean.addColorStop(0.34, "rgba(10,57,76,.88)");
      ocean.addColorStop(0.72, "rgba(4,27,43,.96)");
      ocean.addColorStop(1, "rgba(1,12,23,1)");
      ctx.fillStyle = ocean;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const sunGlint = ctx.createRadialGradient(
        cx - r * 0.38,
        cy - r * 0.42,
        0,
        cx - r * 0.38,
        cy - r * 0.42,
        r * 0.92,
      );
      sunGlint.addColorStop(0, "rgba(144,255,230,.16)");
      sunGlint.addColorStop(0.3, "rgba(71,207,225,.08)");
      sunGlint.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sunGlint;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      // A moving terminator makes the illuminated hemisphere read instantly.
      const terminator = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
      terminator.addColorStop(0, "rgba(1,7,17,.68)");
      terminator.addColorStop(0.44, "rgba(1,9,18,.18)");
      terminator.addColorStop(0.62, "rgba(8,56,72,0)");
      terminator.addColorStop(1, "rgba(0,0,0,.12)");
      ctx.fillStyle = terminator;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      // Night-side city glow, intentionally sparse and warm against the cyan
      // data mesh so the globe feels inhabited rather than decorative.
      for (const city of CITY_LIGHTS) {
        const p = project(city.lat, city.lon, cx, cy, r * 0.997);
        if (p.z > 0.12) continue;
        const glow = Math.min(0.75, (0.12 - p.z) * 1.3 + 0.18);
        ctx.fillStyle = `rgba(255,196,102,${glow})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, city.size, 0, Math.PI * 2);
        ctx.fill();
      }
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
        ctx.strokeStyle = "rgba(39,142,143,.055)";
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
        ctx.strokeStyle = "rgba(39,142,143,.045)";
        ctx.stroke();
      }
      for (const dot of LAND_DOTS) {
        const p = project(dot.lat, dot.lon, cx, cy, r * 0.995);
        if (p.z < 0.015) continue;
        const edgeGlow = Math.pow(1 - p.z, 2.4);
        const twinkle = reducedMotion.matches
          ? 0.8
          : 0.72 + Math.sin(now * 0.0018 + dot.seed * 35) * 0.18;
        const alpha = Math.min(
          0.94,
          (0.22 + p.z * 0.38 + edgeGlow * 0.28) * twinkle,
        );
        const radius = 0.34 + edgeGlow * 0.46 + dot.seed * 0.18;
        const cyanMix = dot.seed > 0.76;
        ctx.fillStyle = cyanMix
          ? `rgba(65,221,255,${alpha * 0.8})`
          : `rgba(91,255,183,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // Financial hub arcs sit above the globe surface and fade on the far side.
      for (const [a, b] of HUB_LINKS) {
        const va = project(HUBS[a]![0], HUBS[a]![1], cx, cy, r * 1.01);
        const vb = project(HUBS[b]![0], HUBS[b]![1], cx, cy, r * 1.01);
        if (va.z < 0 || vb.z < 0) continue;
        const mx = (va.x + vb.x) / 2;
        const my =
          (va.y + vb.y) / 2 -
          r * (0.12 + (Math.hypot(va.x - vb.x, va.y - vb.y) / r) * 0.06);
        ctx.beginPath();
        ctx.moveTo(va.x, va.y);
        ctx.quadraticCurveTo(mx, my, vb.x, vb.y);
        const flow = reducedMotion.matches
          ? 0.45
          : 0.38 + Math.sin(now * 0.002 + a) * 0.14;
        ctx.strokeStyle = `rgba(63,216,255,${flow})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
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
        ctx.shadowBlur = hasChange ? 18 : 0;
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
        if (hasChange) {
          const wave = reducedMotion.matches
            ? 0.5
            : 0.5 + 0.5 * Math.sin(now * 0.004 + lat);
          for (let ring = 0; ring < 2; ring++) {
            const pulse = 1 + ring * 0.7 + wave * 0.85;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5.5 * pulse, 0, Math.PI * 2);
            ctx.strokeStyle = up
              ? `rgba(51,243,154,${0.34 - ring * 0.1})`
              : `rgba(255,89,102,${0.34 - ring * 0.1})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      if (!reducedMotion.matches) {
        const scanX = cx - r + ((now * 0.035) % (r * 2));
        const scan = ctx.createLinearGradient(scanX - 18, 0, scanX + 18, 0);
        scan.addColorStop(0, "rgba(75,255,187,0)");
        scan.addColorStop(0.5, "rgba(75,255,187,.038)");
        scan.addColorStop(1, "rgba(75,255,187,0)");
        ctx.fillStyle = scan;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillRect(scanX - 18, cy - r, 36, r * 2);
        ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      autoRotate = false;
      dragX = event.clientX;
      dragY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
      if (resumeTimer) clearTimeout(resumeTimer);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      rotation += (event.clientX - dragX) * 0.006;
      // Vertical dragging changes the globe's actual camera pitch, so the
      // poles and latitude grid move in perspective instead of sliding as a
      // flat image. Clamp before the globe flips upside down.
      tilt = Math.max(-1.05, Math.min(1.05, tilt + (event.clientY - dragY) * 0.006));
      dragX = event.clientX;
      dragY = event.clientY;
    };
    const onPointerUp = () => {
      dragging = false;
      canvas.style.cursor = pointerInside ? "grab" : "default";
      resumeTimer = setTimeout(() => {
        autoRotate = true;
      }, 3500);
    };
    const onPointerEnter = () => {
      pointerInside = true;
      if (!dragging) canvas.style.cursor = "grab";
    };
    const onPointerLeave = () => {
      pointerInside = false;
      if (!dragging) canvas.style.cursor = "default";
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerenter", onPointerEnter);
    canvas.addEventListener("pointerleave", onPointerLeave);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      if (resumeTimer) clearTimeout(resumeTimer);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerenter", onPointerEnter);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);
  return (
    <div
      ref={wrapRef}
      className="helix-cyber-globe relative h-[390px] touch-none overflow-hidden rounded-lg border border-[#16313b] bg-[radial-gradient(circle_at_48%_45%,rgba(25,85,88,.12),transparent_55%)]"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="helix-globe-scanline pointer-events-none absolute inset-0" />
      <div className="helix-globe-vignette pointer-events-none absolute inset-0" />
      <div className="helix-globe-corner helix-globe-corner-tl" />
      <div className="helix-globe-corner helix-globe-corner-tr" />
      <div className="helix-globe-corner helix-globe-corner-bl" />
      <div className="helix-globe-corner helix-globe-corner-br" />
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
      <div className="pointer-events-none absolute right-3 top-3 font-mono text-[9px] tracking-[.18em] text-[#39ff88]/70">
        SYS // INDEX_NET <span className="helix-live-dot">●</span> LIVE
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-[#6d8991]">
        DRAG TO ROTATE · UP/DOWN TILT · AUTO-PILOT · 60S REFRESH
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[9px] tracking-[.12em] text-[#3fd8ff]/60">
        LAT/LNG GRID // HUB LINK ONLINE
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
                <MiniSparkline values={r.history ?? []} positive={up} />
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-[#718692]">5D</span>
                  <span className={!hasChange ? "text-[#718692]" : up ? "text-[#33f39a]" : "text-[#ff5966]"}>
                    {!hasChange ? "暂无数据" : `${r.changePct! >= 0 ? "+" : ""}${r.changePct!.toFixed(2)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
