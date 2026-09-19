import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Newspaper } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useWatchlist } from "@/hooks/useWatchlist";
import { supabase } from "@/integrations/supabase/client";
import { getIndexBoard } from "@/lib/market.functions";
import { fmtPct, toneClass } from "@/lib/portfolio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Helix Trading — AI 辅助交易分析与纪律管理终端" },
      {
        name: "description",
        content:
          "跨美股、港股与加密货币的持仓管理、每日宏观与持仓定制简报、全球指数归因、标的深度研究与交易纪律日志。仅提供分析辅助，不执行交易。",
      },
      { property: "og:title", content: "Helix Trading — AI 辅助交易分析终端" },
      {
        property: "og:description",
        content:
          "结构化基本面依据 + 事件日历 + 纪律检查，让每一笔交易都有据可循。",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const boardFn = useServerFn(getIndexBoard);
  const { items: watchlist } = useWatchlist();

  const board = useQuery({
    queryKey: ["index-board", watchlist.map((w) => w.symbol).join(",")],
    queryFn: async () => await boardFn({ data: { defs: watchlist } }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const latestBriefing = useQuery({
    queryKey: ["latest-briefing"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefings")
        .select("id, briefing_type, briefing_date, generated_at, payload")
        .order("generated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const summaryText = (() => {
    const p = latestBriefing.data?.payload as { summary?: string } | null;
    return p?.summary ?? null;
  })();

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">市场总览</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            全球指数、市场数据与每日简报
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">全球指数速览</CardTitle>
              <CardDescription className="text-xs">
                最新交易日涨跌
              </CardDescription>
            </CardHeader>
            <CardContent>
              {board.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="divide-y divide-border">
                  {(board.data?.rows ?? []).slice(0, 7).map((row) => (
                    <Link
                      key={row.symbol}
                      to="/markets/$symbol"
                      params={{ symbol: encodeURIComponent(row.symbol) }}
                      className="flex items-center justify-between py-2 hover:text-primary"
                    >
                      <span className="text-xs">{row.label}</span>
                      <span
                        className={`tabular text-xs ${toneClass(row.days.at(-1)?.changePct ?? null)}`}
                      >
                        {fmtPct(row.days.at(-1)?.changePct ?? null)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <Button asChild size="sm" variant="ghost" className="mt-2 w-full">
                <Link to="/markets">
                  查看归因看板 <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Newspaper className="size-4 text-primary" />
                最新简报
              </CardTitle>
              <CardDescription className="text-xs">
                {latestBriefing.data
                  ? `${latestBriefing.data.briefing_type === "macro" ? "宏观简报" : "持仓简报"} · ${latestBriefing.data.briefing_date}`
                  : "今日尚未生成"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                {summaryText ??
                  "到「简报」页生成今日宏观与持仓定制简报，包含事件时间、利多利空与观察要点。"}
              </p>
              <Button asChild size="sm" variant="ghost" className="mt-3">
                <Link to="/briefing">
                  打开每日简报 <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">数据说明</CardTitle>
              <CardDescription className="text-xs">
                行情与简报状态
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>指数行情来自多源免费数据，页面会自动刷新。</p>
              <p>宏观简报按交易日生成，点击下方入口查看完整事件与影响分析。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
