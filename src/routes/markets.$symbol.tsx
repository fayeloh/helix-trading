import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { INDEX_LABELS } from "@/lib/constants";
import { getChart } from "@/lib/market.functions";
import { fmtNum, fmtPct, toneClass } from "@/lib/portfolio";

const RANGES = ["1D", "5D", "1M", "3M", "1Y"] as const;

export const Route = createFileRoute("/markets/$symbol")({
  head: ({ params }) => {
    const raw = decodeURIComponent(params.symbol);
    const label = INDEX_LABELS[raw] ?? raw;
    return {
      meta: [
        { title: `${label} 走势图表 — Helix Trading` },
        {
          name: "description",
          content: `${label}（${raw}）的分时与日线走势，支持 1D / 5D / 1M / 3M / 1Y 区间切换。数据来源 Yahoo Finance。`,
        },
        { property: "og:title", content: `${label} 走势图表 — Helix Trading` },
        { property: "og:description", content: `${label} 多区间走势与涨跌统计。` },
      ],
    };
  },
  component: SymbolChartPage,
});

function SymbolChartPage() {
  const { symbol } = Route.useParams();
  const raw = decodeURIComponent(symbol);
  const label = INDEX_LABELS[raw] ?? raw;
  const [range, setRange] = useState<(typeof RANGES)[number]>("1M");
  const chartFn = useServerFn(getChart);

  const chart = useQuery({
    queryKey: ["chart", raw, range],
    queryFn: async () => await chartFn({ data: { symbol: raw, range } }),
    staleTime: 5 * 60 * 1000,
  });

  const candles = chart.data?.candles ?? [];
  const first = candles[0]?.c;
  const last = candles.at(-1)?.c;
  const change = first && last ? ((last - first) / first) * 100 : null;

  const data = candles.map((c) => ({
    t: c.t,
    label:
      range === "1D" || range === "5D"
        ? new Date(c.t).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : new Date(c.t).toLocaleDateString("zh-CN"),
    close: c.c,
  }));

  return (
    <AppShell>
      <div className="space-y-4">
        <Link to="/markets" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> 返回指数看板
        </Link>

        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-lg">{label}</CardTitle>
              <CardDescription className="tabular text-xs">
                {raw} · {chart.data?.currency ?? ""} · 数据来源 Yahoo Finance（延迟）
              </CardDescription>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="tabular text-2xl font-semibold">{fmtNum(chart.data?.price ?? null)}</span>
                <span className={`tabular text-sm ${toneClass(change)}`}>
                  区间 {fmtPct(change)}
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={r === range ? "default" : "outline"}
                  onClick={() => setRange(r)}
                  className="h-7 px-2.5 text-xs"
                >
                  {r}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {chart.isLoading ? (
              <Skeleton className="h-[360px] w-full" />
            ) : chart.isError || data.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                该区间数据不可用，请切换区间或稍后重试。
              </p>
            ) : (
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                      minTickGap={40}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      formatter={(v: number) => [fmtNum(v), "收盘"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke="var(--color-primary)"
                      strokeWidth={1.6}
                      fill="url(#fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
