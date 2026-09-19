import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { deleteEventImpact, listEventImpacts, updateImpactNote } from "@/lib/impacts.functions";
import { symbolLabel } from "@/lib/symbol-names";
import { useLang, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/impacts")({
  component: ImpactsPage,
  head: () => ({
    meta: [
      { title: "影响复盘 · Event Impact Review — Helix Trading" },
      {
        name: "description",
        content:
          "复盘已记录的重大新闻与财经事件：自动计算相关标的 1日/3日/1周涨跌与持仓层面影响，对比 AI 预判方向。",
      },
      { property: "og:title", content: "影响复盘 · Event Impact Review — Helix Trading" },
      {
        property: "og:description",
        content: "自动价格快照复盘：事件后市场反应与我的持仓关联结果。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const L = {
  zh: {
    title: "影响复盘",
    sub: "已记录事件的后市反应（自动价格快照），用于校验判断与纪律复盘。",
    empty: "还没有记录。在每日简报中点击「记录影响」即可开始跟踪。",
    recorded: "记录时间",
    aiDirection: "AI 预判",
    realized: "实际方向",
    match: "一致",
    mismatch: "不一致",
    symbol: "标的",
    base: "基准价",
    latest: "最新价",
    since: "记录以来",
    portfolio: "持仓层面影响",
    noPortfolio: "记录时无可估值持仓。",
    note: "复盘笔记",
    save: "保存笔记",
    saved: "笔记已保存",
    del: "删除",
    deleted: "已删除",
    fail: "操作失败",
    loading: "计算中…",
    source: "来源",
    kinds: { headline: "头条", econ: "财经事件", earnings: "财报" } as Record<string, string>,
    dirs: { bullish: "利多", bearish: "利空", neutral: "中性", unknown: "未知" } as Record<string, string>,
  },
  en: {
    title: "Impact review",
    sub: "How tracked events actually played out (automatic price snapshots).",
    empty: "Nothing tracked yet. Use “Track impact” in the daily briefing.",
    recorded: "Tracked at",
    aiDirection: "AI call",
    realized: "Realized",
    match: "match",
    mismatch: "mismatch",
    symbol: "Symbol",
    base: "Base",
    latest: "Latest",
    since: "Since",
    portfolio: "Portfolio impact",
    noPortfolio: "No valuable holdings at track time.",
    note: "Review note",
    save: "Save note",
    saved: "Note saved",
    del: "Delete",
    deleted: "Deleted",
    fail: "Action failed",
    loading: "Computing…",
    source: "Source",
    kinds: { headline: "Headline", econ: "Economic", earnings: "Earnings" } as Record<string, string>,
    dirs: { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral", unknown: "Unknown" } as Record<
      string,
      string
    >,
  },
} as const;

type Outcome = {
  symbol: string;
  basePrice: number | null;
  d1: number | null;
  d3: number | null;
  w1: number | null;
  since: number | null;
  latestPrice: number | null;
};

type Row = {
  id: string;
  event_kind: string;
  title: string;
  published_at: string | null;
  source: string | null;
  direction: string;
  symbols: string[];
  note: string | null;
  recorded_at: string;
  review: {
    symbols: Outcome[];
    realizedDirection: string;
    avgSince: number | null;
    portfolio: {
      baseValue: number | null;
      nowValue: number | null;
      deltaPct: number | null;
      deltaAmount: number | null;
    };
  };
};

function Pct({ value }: { value: number | null }) {
  if (value == null) return <span className="tabular text-muted-foreground">—</span>;
  const cls = value > 0 ? "text-up" : value < 0 ? "text-down" : "text-muted-foreground";
  return (
    <span className={`tabular ${cls}`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

function NoteEditor({ row, lang }: { row: Row; lang: Lang }) {
  const t = L[lang];
  const qc = useQueryClient();
  const saveFn = useServerFn(updateImpactNote);
  const [value, setValue] = useState(row.note ?? "");
  useEffect(() => setValue(row.note ?? ""), [row.note]);

  const save = useMutation({
    mutationFn: async () => await saveFn({ data: { id: row.id, note: value } }),
    onSuccess: () => {
      toast.success(t.saved);
      qc.invalidateQueries({ queryKey: ["event-impacts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.fail),
  });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">{t.note}</p>
      <Textarea
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs"
        placeholder={lang === "zh" ? "当时怎么想 / 是否操作 / 结论" : "What I thought, did, concluded"}
      />
      <Button size="sm" variant="secondary" disabled={save.isPending} onClick={() => save.mutate()}>
        {t.save}
      </Button>
    </div>
  );
}

function ImpactsPage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = L[lang];
  const qc = useQueryClient();
  const listFn = useServerFn(listEventImpacts);
  const delFn = useServerFn(deleteEventImpact);

  const list = useQuery({
    queryKey: ["event-impacts"],
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => (await listFn()) as unknown as Row[],
  });

  const remove = useMutation({
    mutationFn: async (id: string) => await delFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t.deleted);
      qc.invalidateQueries({ queryKey: ["event-impacts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.fail),
  });

  const rows = list.data ?? [];

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <LineChart className="size-5 text-primary" />
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.sub}</p>
        </div>

        {list.isLoading ? (
          <p className="text-sm text-muted-foreground">{t.loading}</p>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">{t.empty}</CardContent>
          </Card>
        ) : (
          rows.map((row) => {
            const ai = row.direction;
            const realized = row.review.realizedDirection;
            const comparable = ai !== "unknown" && realized !== "unknown";
            return (
              <Card key={row.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-[240px] flex-1">
                      <CardTitle className="text-base leading-snug">{row.title}</CardTitle>
                      <CardDescription className="tabular mt-1 text-xs">
                        {t.kinds[row.event_kind] ?? row.event_kind}
                        {row.published_at ? ` · ${row.published_at}` : ""}
                        {row.source ? ` · ${t.source}: ${row.source}` : ""}
                        {` · ${t.recorded} ${new Date(row.recorded_at).toLocaleString()}`}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {t.aiDirection}: {t.dirs[ai] ?? ai}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {t.realized}: {t.dirs[realized] ?? realized}
                      </Badge>
                      {comparable ? (
                        <Badge className="text-[10px]" variant={ai === realized ? "default" : "destructive"}>
                          {ai === realized ? t.match : t.mismatch}
                        </Badge>
                      ) : null}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => remove.mutate(row.id)}
                        aria-label={t.del}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {row.review.symbols.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr className="text-left">
                            <th className="py-1 pr-3 font-medium">{t.symbol}</th>
                            <th className="py-1 pr-3 font-medium">{t.base}</th>
                            <th className="py-1 pr-3 font-medium">{t.latest}</th>
                            <th className="py-1 pr-3 font-medium">1D</th>
                            <th className="py-1 pr-3 font-medium">3D</th>
                            <th className="py-1 pr-3 font-medium">1W</th>
                            <th className="py-1 font-medium">{t.since}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.review.symbols.map((o) => (
                            <tr key={o.symbol} className="border-t border-border/60">
                              <td className="py-1 pr-3 font-medium">{symbolLabel(o.symbol)}</td>
                              <td className="tabular py-1 pr-3">{o.basePrice?.toFixed(2) ?? "—"}</td>
                              <td className="tabular py-1 pr-3">{o.latestPrice?.toFixed(2) ?? "—"}</td>
                              <td className="py-1 pr-3">
                                <Pct value={o.d1} />
                              </td>
                              <td className="py-1 pr-3">
                                <Pct value={o.d3} />
                              </td>
                              <td className="py-1 pr-3">
                                <Pct value={o.w1} />
                              </td>
                              <td className="py-1">
                                <Pct value={o.since} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <div className="rounded-md bg-muted/40 p-3 text-xs">
                    <p className="mb-1 font-medium">{t.portfolio}</p>
                    {row.review.portfolio.deltaPct == null ? (
                      <p className="text-muted-foreground">{t.noPortfolio}</p>
                    ) : (
                      <p className="tabular">
                        <Pct value={row.review.portfolio.deltaPct} />
                        {row.review.portfolio.deltaAmount != null
                          ? ` · ${row.review.portfolio.deltaAmount > 0 ? "+" : ""}${row.review.portfolio.deltaAmount.toFixed(2)}`
                          : ""}
                      </p>
                    )}
                  </div>

                  <NoteEditor row={row} lang={lang} />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
