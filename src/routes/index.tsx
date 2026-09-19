import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BookOpenCheck, Newspaper, Wallet } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { useWatchlist } from "@/hooks/useWatchlist";
import { supabase } from "@/integrations/supabase/client";
import { getIndexBoard, getQuotes } from "@/lib/market.functions";
import {
  buildPortfolio,
  fmtMoney,
  fmtPct,
  toneClass,
  type Holding,
  type Quote,
} from "@/lib/portfolio";

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
  const { activeAccount, activeAccountId } = useAccounts();
  const quotesFn = useServerFn(getQuotes);
  const boardFn = useServerFn(getIndexBoard);
  const { items: watchlist } = useWatchlist();

  const holdings = useQuery({
    queryKey: ["holdings", activeAccountId],
    enabled: !!user && !!activeAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holdings")
        .select("*")
        .eq("account_id", activeAccountId!);
      if (error) throw error;
      return (data ?? []) as unknown as Holding[];
    },
  });

  const quoteItems = (holdings.data ?? []).map((h) => ({
    symbol: h.symbol,
    market: h.market,
  }));
  const symbols = quoteItems.map((q) => q.symbol);

  const quotes = useQuery({
    queryKey: ["quotes", symbols.join(",")],
    enabled: symbols.length > 0,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    queryFn: async () =>
      (await quotesFn({ data: { items: quoteItems } })) as Record<
        string,
        Quote
      >,
  });

  const board = useQuery({
    queryKey: ["index-board", watchlist.map((w) => w.symbol).join(",")],
    queryFn: async () => await boardFn({ data: { defs: watchlist } }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const latestBriefing = useQuery({
    queryKey: ["latest-briefing", activeAccountId],
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

  const openTrades = useQuery({
    queryKey: ["open-trades", activeAccountId],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const base = activeAccount?.base_currency ?? "USD";
  const portfolio = buildPortfolio(
    holdings.data ?? [],
    quotes.data ?? {},
    base,
  );

  const movers = [...portfolio.rows]
    .filter((r) => r.changePct != null)
    .sort((a, b) => Math.abs(b.changePct!) - Math.abs(a.changePct!))
    .slice(0, 5);

  const summaryText = (() => {
    const p = latestBriefing.data?.payload as { summary?: string } | null;
    return p?.summary ?? null;
  })();

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">交易台</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            账户 {activeAccount?.name ?? "未选择"} · 基准货币 {base} · 展示时区
            Asia/Shanghai
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-[11px] text-muted-foreground">总市值</div>
              <div className="tabular mt-1 text-lg font-semibold">
                {holdings.isLoading
                  ? "…"
                  : fmtMoney(portfolio.totalValue, base)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-[11px] text-muted-foreground">总成本</div>
              <div className="tabular mt-1 text-lg font-semibold">
                {fmtMoney(portfolio.totalCost, base)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-[11px] text-muted-foreground">浮动盈亏</div>
              <div
                className={`tabular mt-1 text-lg font-semibold ${toneClass(portfolio.totalPnl)}`}
              >
                {fmtMoney(portfolio.totalPnl, base)}
                <span className="ml-2 text-xs">
                  {fmtPct(portfolio.totalPnlPct)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-[11px] text-muted-foreground">
                持仓 / 进行中交易
              </div>
              <div className="tabular mt-1 text-lg font-semibold">
                {portfolio.rows.length} / {openTrades.data ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="size-4 text-primary" />
                  今日持仓波动
                </CardTitle>
                <CardDescription className="text-xs">
                  按绝对涨跌幅排序 · 多源免费延迟行情
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link to="/accounts">
                  管理持仓 <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {holdings.isLoading || quotes.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : movers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  暂无带行情的持仓。到「账户」页手动录入或用 CSV 导入。
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {movers.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div>
                        <div className="tabular text-sm font-medium">
                          {r.symbol}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.display_name ?? r.sector ?? r.market}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`tabular text-sm ${toneClass(r.changePct)}`}
                        >
                          {fmtPct(r.changePct)}
                        </div>
                        <div className="tabular text-[11px] text-muted-foreground">
                          权重 {fmtPct(r.weightPct)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpenCheck className="size-4 text-primary" />
                板块分布
              </CardTitle>
              <CardDescription className="text-xs">按市值权重</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {portfolio.sectors.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚无持仓数据。</p>
              ) : (
                portfolio.sectors.slice(0, 6).map((s) => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-xs">
                      <span>{s.name}</span>
                      <span className="tabular text-muted-foreground">
                        {s.pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {portfolio.markets.map((m) => (
                  <Badge key={m.name} variant="outline" className="text-[10px]">
                    {m.name} {m.pct.toFixed(0)}%
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
