import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { KindBadge } from "@/components/Disclaimer";
import { SymbolSearchInput } from "@/components/SymbolSearchInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useWatchlist, type WatchItem } from "@/hooks/useWatchlist";
import { INDEX_BOARD, INDEX_CATALOG } from "@/lib/constants";
import { getIndexAttributions, getIndexBoard } from "@/lib/market.functions";
import { fmtNum, fmtPct, toneClass } from "@/lib/portfolio";
import { GlobalIndexGlobe } from "@/components/GlobalIndexGlobe";

export const Route = createFileRoute("/markets/")({
  head: () => ({
    meta: [
      { title: "全球指数看板与涨跌归因 — Helix Trading" },
      {
        name: "description",
        content:
          "标普500、纳斯达克、恒生科技、沪深300、黄金、比特币、美元指数、VIX 与美债 10Y 的近 5 个交易日涨跌与 AI 归因说明，看板可自由增删排序。",
      },
      { property: "og:title", content: "全球指数看板 — Helix Trading" },
      {
        property: "og:description",
        content: "跨市场指数 5 日涨跌与归因逻辑链，支持自定义看板。",
      },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  const boardFn = useServerFn(getIndexBoard);
  const attrFn = useServerFn(getIndexAttributions);
  const { items: watchlist } = useWatchlist();
  const key = watchlist.map((w) => w.symbol).join(",");

  const board = useQuery({
    queryKey: ["index-board", key],
    queryFn: async () => await boardFn({ data: { defs: watchlist } }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const attributions = useQuery({
    queryKey: ["index-attributions", key],
    queryFn: async () => await attrFn({ data: { defs: watchlist } }),
    enabled: !!board.data,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const attrMap = new Map(
    (attributions.data?.items ?? []).map((a) => [a.symbol, a]),
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">全球指数看板</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              过去 5 个交易日涨跌幅 + 每日归因。行情来自多源免费数据并自动回退
              {board.data
                ? ` · 抓取时间 ${new Date(board.data.fetchedAt).toLocaleString("zh-CN")}`
                : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <BoardEditor />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                board.refetch();
                attributions.refetch();
              }}
              disabled={board.isFetching}
            >
              <RefreshCw
                className={`mr-1 size-3.5 ${board.isFetching ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
          </div>
        </div>

        <GlobalIndexGlobe
          rows={(board.data?.rows ?? []).map((r) => ({
            symbol: r.symbol,
            label: r.label,
            price: r.price,
            changePct: r.days.at(-1)?.changePct ?? null,
          }))}
        />

        {board.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : board.isError ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              行情数据暂不可用，请稍后刷新。
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {board.data!.rows.map((row) => {
              const latest = row.days.at(-1);
              const attr = attrMap.get(row.symbol);
              return (
                <Card key={row.symbol} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm">
                          <Link
                            to="/markets/$symbol"
                            params={{ symbol: encodeURIComponent(row.symbol) }}
                            className="hover:text-primary"
                          >
                            {row.label}
                          </Link>
                        </CardTitle>
                        <CardDescription className="tabular text-[11px]">
                          {row.symbol}
                          {row.source ? ` · ${row.source}` : ""}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="tabular text-sm font-semibold">
                          {fmtNum(row.price)}
                        </div>
                        <div
                          className={`tabular text-xs ${toneClass(latest?.changePct ?? null)}`}
                        >
                          {fmtPct(latest?.changePct ?? null)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {row.error ? (
                      <p className="text-xs text-warn">
                        数据不可用：{row.error}
                      </p>
                    ) : (
                      <div className="flex gap-1">
                        {row.days.map((d) => (
                          <div key={d.date} className="flex-1 text-center">
                            <div
                              className={`tabular rounded px-1 py-1 text-[11px] ${
                                (d.changePct ?? 0) > 0
                                  ? "bg-bull-muted/50 text-bull"
                                  : (d.changePct ?? 0) < 0
                                    ? "bg-bear-muted/50 text-bear"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {d.changePct == null
                                ? "—"
                                : `${d.changePct.toFixed(2)}%`}
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {d.date.slice(5)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!row.error && latest?.changePct == null ? (
                      <p className="text-[11px] text-muted-foreground">
                        当前数据源未返回可比较的上一交易日，涨跌幅显示为暂无数据。
                      </p>
                    ) : null}

                    <div className="rounded-md bg-muted/40 p-2.5">
                      {attributions.isLoading ? (
                        <Skeleton className="h-8 w-full" />
                      ) : attr ? (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium">{attr.driver}</p>
                            <KindBadge
                              kind={attr.kind}
                              confidence={attr.confidence}
                            />
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                            {attr.logic}
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          归因生成中或暂不可用。
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {attributions.data?.caveats ? (
          <p className="text-[11px] text-muted-foreground">
            数据说明：{attributions.data.caveats}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}

function BoardEditor() {
  const { items, isCustom, save } = useWatchlist();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WatchItem[]>(items);
  const [symbol, setSymbol] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (open) setDraft(items);
  }, [open, items]);

  const has = (s: string) =>
    draft.some((d) => d.symbol.toUpperCase() === s.toUpperCase());

  const add = (item: WatchItem) => {
    if (has(item.symbol)) return;
    setDraft((d) => [...d, item]);
  };

  const move = (i: number, dir: -1 | 1) => {
    setDraft((d) => {
      const next = [...d];
      const j = i + dir;
      if (j < 0 || j >= next.length) return d;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const addCustom = () => {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    if (has(s)) {
      toast.error("该标的已在看板中");
      return;
    }
    add({ symbol: s, label: label.trim() || s, group: "个股" });
    setSymbol("");
    setLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="mr-1 size-3.5" />
          编辑看板
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>自定义指数看板</DialogTitle>
          <DialogDescription>
            增删与排序会保存到你的账户，换设备后一致。代码使用 Yahoo Finance
            格式（如 GC=F 黄金、^HSTECH 恒生科技、BTC-USD 比特币、AAPL 个股）。
            {isCustom ? "" : " 当前使用默认列表。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              当前看板（{draft.length}）
            </p>
            <div className="space-y-1.5">
              {draft.map((it, i) => (
                <div
                  key={it.symbol}
                  className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                >
                  <span className="text-sm font-medium">{it.label}</span>
                  <span className="tabular text-[11px] text-muted-foreground">
                    {it.symbol}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {it.group}
                  </Badge>
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-bear"
                      onClick={() =>
                        setDraft((d) => d.filter((x) => x.symbol !== it.symbol))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {draft.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  看板为空，保存后将回落到默认列表。
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              从候选中添加
            </p>
            <div className="flex flex-wrap gap-1.5">
              {INDEX_CATALOG.filter((c) => !has(c.symbol)).map((c) => (
                <Button
                  key={c.symbol}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => add(c)}
                >
                  <Plus className="mr-1 size-3" />
                  {c.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              添加任意标的
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="w-56">
                <SymbolSearchInput
                  placeholder="搜索代码或名称，如 TSLA / 黄金"
                  value={symbol}
                  onChange={setSymbol}
                  onSelect={(s) => {
                    setSymbol(s.symbol);
                    if (!label.trim()) setLabel(s.name);
                  }}
                  onEnter={addCustom}
                />
              </div>
              <Input
                placeholder="显示名称（可选）"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-40"
              />
              <Button size="sm" variant="secondary" onClick={addCustom}>
                添加
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDraft(INDEX_BOARD)}
          >
            恢复默认
          </Button>
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() => {
              save.mutate(draft, {
                onSuccess: () => {
                  toast.success("看板已保存");
                  setOpen(false);
                },
                onError: (e) =>
                  toast.error(e instanceof Error ? e.message : "保存失败"),
              });
            }}
          >
            {save.isPending ? "保存中…" : "保存看板"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
