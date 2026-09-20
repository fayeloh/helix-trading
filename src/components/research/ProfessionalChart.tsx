import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChartCandlestick,
  Crosshair,
  Eraser,
  Minus,
  MousePointer2,
  RefreshCw,
  Square,
  TrendingUp,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getChart } from "@/lib/market.functions";
import { fmtNum, fmtPct, toneClass } from "@/lib/portfolio";

type Candle = { t: number; c: number; o: number; h: number; l: number };
type Tool = "cursor" | "trend" | "horizontal" | "rectangle";
type Point = { index: number; price: number };
type Drawing = {
  id: string;
  tool: Exclude<Tool, "cursor">;
  start: Point;
  end: Point;
};

const RANGES = ["1H", "4H", "1D", "1W"] as const;
const VIEW_W = 1200;
const VIEW_H = 500;
const PAD = { top: 26, right: 76, bottom: 34, left: 12 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

function chartSymbol(symbol: string, market: string) {
  const value = symbol.trim().toUpperCase();
  if (value.includes(".") || value.includes("-") || value.startsWith("^"))
    return value;
  if (market === "HK") return `${value.replace(/^0+/, "").padStart(4, "0")}.HK`;
  if (market === "CN")
    return value.startsWith("6") ? `${value}.SS` : `${value}.SZ`;
  if (market === "CRYPTO") return `${value}-USD`;
  return value;
}

function movingAverage(candles: Candle[], length: number) {
  return candles.map((_, index) => {
    if (index < length - 1) return null;
    const window = candles.slice(index - length + 1, index + 1);
    return window.reduce((sum, candle) => sum + candle.c, 0) / length;
  });
}

function formatAxisDate(time: number, range: string) {
  const date = new Date(time);
  return range === "1H" || range === "4H"
    ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function ProfessionalChart({
  symbol,
  market,
}: {
  symbol: string;
  market: string;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("1D");
  const [tool, setTool] = useState<Tool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [showMa5, setShowMa5] = useState(true);
  const [showMa20, setShowMa20] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const fetchChart = useServerFn(getChart);
  const resolvedSymbol = chartSymbol(symbol, market);
  const storageKey = `helix-chart-drawings:${resolvedSymbol}:${range}`;

  const chart = useQuery({
    queryKey: ["research-professional-chart", resolvedSymbol, range],
    queryFn: async () =>
      await fetchChart({ data: { symbol: resolvedSymbol, range } }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const candles = chart.data?.candles ?? [];
  const values = useMemo(() => candles.flatMap((c) => [c.h, c.l]), [candles]);
  const priceMin = values.length ? Math.min(...values) : 0;
  const priceMax = values.length ? Math.max(...values) : 1;
  const pricePadding = Math.max((priceMax - priceMin) * 0.08, priceMax * 0.002);
  const domainMin = priceMin - pricePadding;
  const domainMax = priceMax + pricePadding;
  const span = Math.max(domainMax - domainMin, 1);
  const ma5 = useMemo(() => movingAverage(candles, 5), [candles]);
  const ma20 = useMemo(() => movingAverage(candles, 20), [candles]);
  const closeLine = useMemo(() => candles.map((candle) => candle.c), [candles]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      setDrawings(saved ? (JSON.parse(saved) as Drawing[]) : []);
    } catch {
      setDrawings([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(drawings));
    } catch {
      // 本地存储不可用时，画线仍在当前会话内有效。
    }
  }, [drawings, storageKey]);

  const xFor = (index: number) =>
    PAD.left +
    (Math.max(0, Math.min(candles.length - 1, index)) /
      Math.max(1, candles.length - 1)) *
      PLOT_W;
  const yFor = (price: number) =>
    PAD.top + ((domainMax - price) / span) * PLOT_H;

  const pointerPoint = (
    event: React.PointerEvent<SVGSVGElement>,
  ): Point | null => {
    if (!svgRef.current || candles.length === 0) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((event.clientY - rect.top) / rect.height) * VIEW_H;
    const index = Math.round(
      ((x - PAD.left) / PLOT_W) * Math.max(1, candles.length - 1),
    );
    const price = domainMax - ((y - PAD.top) / PLOT_H) * span;
    return {
      index: Math.max(0, Math.min(candles.length - 1, index)),
      price: Math.max(domainMin, Math.min(domainMax, price)),
    };
  };

  const beginDrawing = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = pointerPoint(event);
    if (!point) return;
    setHover(point);
    if (tool === "cursor") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "horizontal") {
      setDrawings((items) => [
        ...items,
        { id: crypto.randomUUID(), tool, start: point, end: point },
      ]);
      return;
    }
    setDraft({ id: crypto.randomUUID(), tool, start: point, end: point });
  };

  const movePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = pointerPoint(event);
    if (!point) return;
    setHover(point);
    setDraft((current) => (current ? { ...current, end: point } : null));
  };

  const finishDrawing = () => {
    if (draft) setDrawings((items) => [...items, draft]);
    setDraft(null);
  };

  const price = chart.data?.price ?? candles.at(-1)?.c ?? null;
  const previousClose = chart.data?.previousClose ?? candles.at(-2)?.c ?? null;
  const change =
    price != null && previousClose
      ? ((price - previousClose) / previousClose) * 100
      : null;
  const hoverCandle = hover ? candles[hover.index] : undefined;
  const visibleDrawings = draft ? [...drawings, draft] : drawings;
  const candleWidth = Math.max(
    2,
    Math.min(10, (PLOT_W / Math.max(1, candles.length)) * 0.65),
  );

  const pathFor = (series: (number | null)[]) =>
    series
      .map((value, index) =>
        value == null
          ? null
          : `${index === 0 || series[index - 1] == null ? "M" : "L"}${xFor(index)},${yFor(value)}`,
      )
      .filter(Boolean)
      .join(" ");

  return (
    <Card className="overflow-hidden border-border/80 bg-[#090d10]">
      <CardHeader className="space-y-3 border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold">{resolvedSymbol}</span>
              <span
                className={`tabular text-2xl font-semibold ${toneClass(change)}`}
              >
                {fmtNum(price)}
              </span>
              <span
                className={`tabular text-sm font-medium ${toneClass(change)}`}
              >
                {fmtPct(change)}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {chart.data?.currency ?? ""} ·{" "}
                {chart.data?.source ?? "多源行情"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              行情每 60 秒刷新；数据源可能延迟。当前共 {candles.length} 根 K
              线，白线为收盘价走势。画线自动保存在本机浏览器。
            </p>
          </div>
          <div className="flex items-center gap-1">
            {RANGES.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={range === item ? "default" : "ghost"}
                className="h-7 px-2 text-[11px]"
                onClick={() => setRange(item)}
              >
                {item}
              </Button>
            ))}
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              title="刷新行情"
              onClick={() => void chart.refetch()}
            >
              <RefreshCw
                className={`size-3.5 ${chart.isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <ChartTool
            active={tool === "cursor"}
            title="十字光标"
            onClick={() => setTool("cursor")}
          >
            <MousePointer2 />
          </ChartTool>
          <ChartTool
            active={tool === "trend"}
            title="趋势线"
            onClick={() => setTool("trend")}
          >
            <TrendingUp />
          </ChartTool>
          <ChartTool
            active={tool === "horizontal"}
            title="水平线"
            onClick={() => setTool("horizontal")}
          >
            <Minus />
          </ChartTool>
          <ChartTool
            active={tool === "rectangle"}
            title="矩形标注"
            onClick={() => setTool("rectangle")}
          >
            <Square />
          </ChartTool>
          <span className="mx-1 h-5 w-px bg-border" />
          <ChartTool
            title="撤销"
            disabled={drawings.length === 0}
            onClick={() => setDrawings((items) => items.slice(0, -1))}
          >
            <Undo2 />
          </ChartTool>
          <ChartTool
            title="清空画线"
            disabled={drawings.length === 0}
            onClick={() => setDrawings([])}
          >
            <Eraser />
          </ChartTool>
          <span className="mx-1 h-5 w-px bg-border" />
          <button
            type="button"
            className={`rounded px-2 py-1 text-[10px] ${showMa5 ? "bg-[#b968ff]/15 text-[#d39cff]" : "text-muted-foreground"}`}
            onClick={() => setShowMa5((value) => !value)}
          >
            MA5
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-[10px] ${showMa20 ? "bg-[#20b9ff]/15 text-[#62ccff]" : "text-muted-foreground"}`}
            onClick={() => setShowMa20((value) => !value)}
          >
            MA20
          </button>
          <span className="ml-auto hidden text-[10px] text-muted-foreground sm:inline">
            {hoverCandle
              ? `${new Date(hoverCandle.t).toLocaleString("zh-CN")}  开 ${fmtNum(hoverCandle.o)}  高 ${fmtNum(hoverCandle.h)}  低 ${fmtNum(hoverCandle.l)}  收 ${fmtNum(hoverCandle.c)}`
              : "移动光标查看 OHLC"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {chart.isLoading ? (
          <Skeleton className="h-[420px] w-full rounded-none" />
        ) : chart.isError || candles.length === 0 ? (
          <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <ChartCandlestick className="size-8 opacity-50" />
            <span>
              {chart.error instanceof Error
                ? chart.error.message
                : "暂时无法取得该标的行情"}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void chart.refetch()}
            >
              重试
            </Button>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className={`block h-auto min-h-[360px] w-full select-none touch-none ${tool === "cursor" ? "cursor-crosshair" : "cursor-cell"}`}
            onPointerDown={beginDrawing}
            onPointerMove={movePointer}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
            onPointerLeave={() => {
              if (!draft) setHover(null);
            }}
            role="img"
            aria-label={`${resolvedSymbol} 专业 K 线图与画线工具`}
          >
            <rect width={VIEW_W} height={VIEW_H} fill="#090d10" />
            {Array.from({ length: 6 }, (_, index) => {
              const y = PAD.top + (index / 5) * PLOT_H;
              const axisPrice = domainMax - (index / 5) * span;
              return (
                <g key={`y-${index}`}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + PLOT_W}
                    y1={y}
                    y2={y}
                    stroke="#20282d"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD.left + PLOT_W + 8}
                    y={y + 4}
                    fill="#77838a"
                    fontSize="11"
                  >
                    {fmtNum(axisPrice)}
                  </text>
                </g>
              );
            })}
            {Array.from({ length: 7 }, (_, index) => {
              const candleIndex = Math.round(
                (index / 6) * Math.max(0, candles.length - 1),
              );
              const x = xFor(candleIndex);
              return (
                <g key={`x-${index}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={PAD.top}
                    y2={PAD.top + PLOT_H}
                    stroke="#151c20"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={VIEW_H - 10}
                    fill="#77838a"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {formatAxisDate(candles[candleIndex]!.t, range)}
                  </text>
                </g>
              );
            })}

            {candles.map((candle, index) => {
              const x = xFor(index);
              const rising = candle.c >= candle.o;
              const color = rising ? "#23d18b" : "#ff5263";
              const bodyTop = yFor(Math.max(candle.o, candle.c));
              const bodyBottom = yFor(Math.min(candle.o, candle.c));
              return (
                <g key={candle.t}>
                  <line
                    x1={x}
                    x2={x}
                    y1={yFor(candle.h)}
                    y2={yFor(candle.l)}
                    stroke={color}
                    strokeWidth="1"
                  />
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={Math.max(1.5, bodyBottom - bodyTop)}
                    fill={rising ? "#23d18b" : "#ff5263"}
                    opacity="0.92"
                  />
                </g>
              );
            })}

            <path
              d={pathFor(closeLine)}
              fill="none"
              stroke="#f4f7f8"
              strokeWidth={candles.length <= 5 ? 3 : 1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.95"
            />
            {candles.length <= 12
              ? candles.map((candle, index) => (
                  <circle
                    key={`close-${candle.t}`}
                    cx={xFor(index)}
                    cy={yFor(candle.c)}
                    r={candles.length <= 5 ? 4 : 2.5}
                    fill="#f4f7f8"
                    stroke="#090d10"
                    strokeWidth="1.5"
                  />
                ))
              : null}

            {showMa5 ? (
              <path
                d={pathFor(ma5)}
                fill="none"
                stroke="#c477ff"
                strokeWidth="1.6"
              />
            ) : null}
            {showMa20 ? (
              <path
                d={pathFor(ma20)}
                fill="none"
                stroke="#28bfff"
                strokeWidth="1.6"
              />
            ) : null}

            {price != null ? (
              <g>
                <line
                  x1={PAD.left}
                  x2={PAD.left + PLOT_W}
                  y1={yFor(price)}
                  y2={yFor(price)}
                  stroke={change != null && change < 0 ? "#ff5263" : "#23d18b"}
                  strokeDasharray="4 4"
                  opacity="0.8"
                />
                <rect
                  x={PAD.left + PLOT_W}
                  y={yFor(price) - 10}
                  width={74}
                  height={20}
                  fill={change != null && change < 0 ? "#d83f50" : "#168a61"}
                />
                <text
                  x={PAD.left + PLOT_W + 37}
                  y={yFor(price) + 4}
                  fill="#fff"
                  fontSize="11"
                  textAnchor="middle"
                >
                  {fmtNum(price)}
                </text>
              </g>
            ) : null}

            {visibleDrawings.map((drawing) => {
              const x1 = xFor(drawing.start.index);
              const x2 = xFor(drawing.end.index);
              const y1 = yFor(drawing.start.price);
              const y2 = yFor(drawing.end.price);
              if (drawing.tool === "horizontal") {
                return (
                  <line
                    key={drawing.id}
                    x1={PAD.left}
                    x2={PAD.left + PLOT_W}
                    y1={y1}
                    y2={y1}
                    stroke="#ffc857"
                    strokeWidth="1.5"
                    strokeDasharray="7 4"
                  />
                );
              }
              if (drawing.tool === "rectangle") {
                return (
                  <rect
                    key={drawing.id}
                    x={Math.min(x1, x2)}
                    y={Math.min(y1, y2)}
                    width={Math.abs(x2 - x1)}
                    height={Math.abs(y2 - y1)}
                    fill="rgba(255,200,87,.10)"
                    stroke="#ffc857"
                    strokeWidth="1.5"
                  />
                );
              }
              return (
                <line
                  key={drawing.id}
                  x1={x1}
                  x2={x2}
                  y1={y1}
                  y2={y2}
                  stroke="#ffc857"
                  strokeWidth="2"
                />
              );
            })}

            {hover && !draft ? (
              <g pointerEvents="none">
                <line
                  x1={xFor(hover.index)}
                  x2={xFor(hover.index)}
                  y1={PAD.top}
                  y2={PAD.top + PLOT_H}
                  stroke="#8b989f"
                  strokeDasharray="3 4"
                  opacity="0.7"
                />
                <line
                  x1={PAD.left}
                  x2={PAD.left + PLOT_W}
                  y1={yFor(hover.price)}
                  y2={yFor(hover.price)}
                  stroke="#8b989f"
                  strokeDasharray="3 4"
                  opacity="0.7"
                />
                <circle
                  cx={xFor(hover.index)}
                  cy={yFor(candles[hover.index]!.c)}
                  r="3"
                  fill="#fff"
                />
              </g>
            ) : null}
          </svg>
        )}
      </CardContent>
    </Card>
  );
}

function ChartTool({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "default" : "ghost"}
      className="size-7 [&_svg]:size-3.5"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
