import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Database,
  GitBranch,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { KindBadge } from "@/components/Disclaimer";
import { ProfessionalChart } from "@/components/research/ProfessionalChart";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LOOKBACK_OPTIONS,
  MARKETS,
  RESEARCH_SECTIONS,
  type MarketCode,
  type ResearchSection,
} from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import { symbolLabel } from "@/lib/symbol-names";
import { formatFullInZone } from "@/lib/time-format";
import { useTimezone } from "@/lib/timezone";
import { getResearchSection } from "@/lib/research.functions";
import { fmtNum, fmtPct, toneClass } from "@/lib/portfolio";

type Row = { payload: unknown; generated_at: string; model: string | null };

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "标的深度研究：基本面 / 财报 / 周期 / 资金流 — Helix Trading" },
      {
        name: "description",
        content:
          "输入美股、港股或加密货币代码，自动生成基本面业务拆解、近三次财报与下次财报预期、行业周期与季节性、机构与聪明钱资金流向四份结构化研究。",
      },
      { property: "og:title", content: "标的深度研究 — Helix Trading" },
      {
        property: "og:description",
        content: "四模块结构化研究报告，事实与推演分离标注。",
      },
    ],
  }),
  component: ResearchPage,
});

function ResearchPage() {
  const [input, setInput] = useState("");
  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState<MarketCode>("US");
  const [lookback, setLookback] = useState(90);
  const [section, setSection] = useState<ResearchSection | "chart">(
    "fundamentals",
  );
  const [results, setResults] = useState<Record<string, Row>>({});
  const [loadingAll, setLoadingAll] = useState(false);
  const { lang, locale, t } = useLang();

  const fetchFn = useServerFn(getResearchSection);

  const run = useMutation({
    mutationFn: async (vars: {
      symbol: string;
      section: ResearchSection;
      force: boolean;
    }) =>
      (await fetchFn({
        data: {
          symbol: vars.symbol,
          market,
          section: vars.section,
          lookbackDays: lookback,
          lang,
          force: vars.force,
        },
      })) as Row,
    onSuccess: (row, vars) => {
      setResults((p) => ({
        ...p,
        [`${vars.symbol}:${vars.section}:${lookback}:${lang}`]: row,
      }));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "生成失败"),
  });

  const current = results[`${symbol}:${section}:${lookback}:${lang}`];

  const submit = () => {
    const s = input.trim().toUpperCase();
    if (!s) return;
    setSymbol(s);
    setResults({});
    setLoadingAll(true);
    void Promise.allSettled(
      RESEARCH_SECTIONS.map(async ({ key }) => {
        const row = (await fetchFn({
          data: {
            symbol: s,
            market,
            section: key,
            lookbackDays: lookback,
            lang,
            force: false,
          },
        })) as Row;
        setResults((previous) => ({
          ...previous,
          [`${s}:${key}:${lookback}:${lang}`]: row,
        }));
      }),
    ).then((settled) => {
      setLoadingAll(false);
      const failed = settled.filter((item) => item.status === "rejected");
      if (failed.length > 0) {
        toast.error(`${failed.length} 个研究模块暂时无法生成，请稍后重试`);
      }
    });
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">{t("research.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("research.subtitle")}
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-2 py-4">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("research.symbol")}
              </label>
              <SymbolSearchInput
                value={input}
                onChange={setInput}
                onSelect={(s) => {
                  if (s.market !== "OTHER") setMarket(s.market);
                }}
                onEnter={submit}
                placeholder="TSLA / 0700.HK / BTC-USD"
                className="tabular"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("research.market")}
              </label>
              <Select
                value={market}
                onValueChange={(v) => setMarket(v as MarketCode)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKETS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("research.window")}
              </label>
              <Select
                value={String(lookback)}
                onValueChange={(v) => setLookback(Number(v))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOOKBACK_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} {t("research.days")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="w-full text-xs leading-relaxed text-muted-foreground">
              资金流窗口 = 回看多少天的「谁在买、谁在卖」证据（机构 13F
              持仓变动、内部人 Form 4
              买卖、加密链上大额地址），与价格涨跌窗口无关。30
              天更及时但噪音大，90/180 天更能看出趋势但更滞后；13F 最长滞后 45
              天，港股披露有限、加密地址无法确认身份，缺失数据会留空并列入「数据缺口」。
            </p>

            <Button onClick={submit} disabled={run.isPending || loadingAll}>
              <Search className="mr-1 size-3.5" />
              {loadingAll ? t("research.generating") : t("research.run")}
            </Button>
          </CardContent>
        </Card>

        {symbol ? (
          <div className="space-y-5">
            <Tabs
              value={section}
              onValueChange={(v) => setSection(v as ResearchSection | "chart")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="chart" className="text-xs">
                    图表
                  </TabsTrigger>
                  {RESEARCH_SECTIONS.map((s) => (
                    <TabsTrigger key={s.key} value={s.key} className="text-xs">
                      {t(`section.${s.key}`)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="tabular text-[11px]">
                    {symbolLabel(symbol)}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run.mutate({
                        symbol,
                        section: section === "chart" ? "fundamentals" : section,
                        force: false,
                      })
                    }
                    disabled={run.isPending || loadingAll}
                  >
                    <Sparkles className="mr-1 size-3.5" />
                    {run.isPending
                      ? t("research.generating")
                      : t("research.generate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      run.mutate({
                        symbol,
                        section: section === "chart" ? "fundamentals" : section,
                        force: true,
                      })
                    }
                    disabled={run.isPending || loadingAll}
                  >
                    {t("research.recompute")}
                  </Button>
                </div>
              </div>

              <TabsContent value="chart" className="mt-4">
                <ProfessionalChart symbol={symbol} market={market} />
              </TabsContent>

              {RESEARCH_SECTIONS.map((s) => (
                <TabsContent key={s.key} value={s.key} className="mt-4">
                  {(loadingAll || (run.isPending && section === s.key)) &&
                  !current ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-40 w-full" />
                    </div>
                  ) : current ? (
                    <div className="space-y-4">
                      <ResearchTrustPanel payload={current.payload} />
                      <SectionBody
                        section={s.key}
                        payload={current.payload as never}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {t("research.meta", {
                          time: new Date(current.generated_at).toLocaleString(
                            locale,
                          ),
                          model: current.model ?? "—",
                        })}
                      </p>
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        {t("research.empty")}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

type Claim = {
  text: string;
  kind: string;
  source: string | null;
  as_of: string | null;
  confidence: string | null;
};
type Share = {
  name: string;
  revenue_share_pct: number | null;
  note?: string;
  kind: string;
  source: string | null;
  as_of: string | null;
};

type TrustMetrics = {
  facts: number;
  inferences: number;
  sources: string[];
};

function collectTrustMetrics(value: unknown): TrustMetrics {
  const metrics: TrustMetrics = { facts: 0, inferences: 0, sources: [] };
  const sources = new Set<string>();

  const visit = (node: unknown, key = "") => {
    if (key === "_facts" || key === "_debate") return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item));
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record["kind"] === "fact") metrics.facts += 1;
    if (record["kind"] === "inference") metrics.inferences += 1;
    if (typeof record["source"] === "string" && record["source"].trim()) {
      sources.add(record["source"].trim());
    }
    Object.entries(record).forEach(([childKey, child]) =>
      visit(child, childKey),
    );
  };

  visit(value);
  metrics.sources = [...sources];
  return metrics;
}

function ResearchTrustPanel({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return null;
  const p = payload as Record<string, any>;
  const trace = p["_debate"] as Record<string, any> | undefined;
  const verifier = trace?.["verifier_result"] as
    Record<string, any> | undefined;
  const metrics = collectTrustMetrics(payload);
  const bull = trace?.["agents"]?.["bull"];
  const bear = trace?.["agents"]?.["bear"];
  const architecture = trace?.["architecture"];
  const fallback = architecture === "single-call-fallback";
  const verified = verifier?.["passed"] === true;

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-primary" />
              研究可信度
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              结论、来源和 Agent 执行状态均随报告保存，可复核、可回放。
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={verified ? "border-bull/40 text-bull" : ""}
          >
            {verifier
              ? verified
                ? "事实校验通过"
                : "事实校验未通过"
              : "确定性数据已附带"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border/70 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Database className="size-3.5" /> 证据覆盖
            </div>
            <p className="mt-1 tabular text-sm font-semibold">
              {metrics.facts} 项事实 · {metrics.inferences} 项推演
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {metrics.sources.length} 个已标注来源
            </p>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5" /> 程序校验
            </div>
            <p className="mt-1 tabular text-sm font-semibold">
              {verifier
                ? `${verifier["checked_values"] ?? 0} 个数字/日期`
                : "本模块未启用 Verifier"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {verifier
                ? `${verifier["violations"]?.length ?? 0} 个未接地值`
                : "保留事实与推演标签"}
            </p>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <GitBranch className="size-3.5" /> 研究路径
            </div>
            <p className="mt-1 text-sm font-semibold">
              {architecture
                ? fallback
                  ? "单模型安全回退"
                  : "Bull / Bear 多 Agent"
                : "确定性数据 + AI 解读"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {fallback
                ? "部分 Agent 失败，已保留可用输出"
                : trace
                  ? "双视角完成后综合"
                  : "缺失字段保持为空"}
            </p>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Timer className="size-3.5" /> Agent 状态
            </div>
            <p className="mt-1 tabular text-sm font-semibold">
              {trace
                ? `Bull ${bull?.status ?? "—"} · Bear ${bear?.status ?? "—"}`
                : "无需并行 Agent"}
            </p>
            <p className="mt-1 tabular text-[10px] text-muted-foreground">
              {trace
                ? `${bull?.duration_ms ?? 0}ms / ${bear?.duration_ms ?? 0}ms`
                : "报告保留生成时间与模型"}
            </p>
          </div>
        </div>
        {metrics.sources.length > 0 ? (
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            来源：{metrics.sources.slice(0, 6).join("、")}
            {metrics.sources.length > 6
              ? ` 等 ${metrics.sources.length} 个`
              : ""}
          </p>
        ) : null}
        {trace?.["fallback_reason"] ? (
          <p className="mt-2 rounded bg-warn/10 px-2 py-1.5 text-[10px] text-warn">
            回退原因：{trace["fallback_reason"]}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function arr<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v == null || v === "") return [];
  return [v as T];
}

function toClaim(v: unknown): Claim {
  if (typeof v === "string")
    return {
      text: v,
      kind: "fact",
      confidence: null,
      source: null,
      as_of: null,
    } as Claim;
  return v as Claim;
}

function ProfileCard({ profile }: { profile: any }) {
  const { t } = useLang();
  const p = profile ?? {};
  const rows: [string, unknown][] = [
    [t("f.fullName"), p.legal_name],
    [t("f.exchange"), p.exchange_ticker],
    [t("f.sector"), [p.sector, p.industry].filter(Boolean).join(" / ")],
    [t("f.founded"), p.founded],
    [t("f.hq"), p.headquarters],
    [
      t("f.employees"),
      p.employees == null ? null : fmtNum(Number(p.employees), 0),
    ],
    [t("f.marketCap"), p.market_cap],
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{t("f.profile")}</CardTitle>
          <KindBadge kind={p.kind ?? "fact"} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {p.summary ? (
          <p className="text-sm leading-relaxed">{p.summary}</p>
        ) : null}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs md:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular mt-0.5 font-medium">
                {(value as string) || "—"}
              </dd>
            </div>
          ))}
          {p.website ? (
            <div>
              <dt className="text-muted-foreground">{t("f.website")}</dt>
              <dd className="mt-0.5 truncate font-medium">
                <a
                  href={p.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline"
                >
                  {String(p.website).replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
        <p className="text-[11px] text-muted-foreground">
          {t("common.source")} {p.source ?? t("common.unlabeled")} ·{" "}
          {t("common.asOf")} {p.as_of ?? t("common.unlabeled")}
        </p>
      </CardContent>
    </Card>
  );
}

function PeerCard({
  peers,
  advantages,
  disadvantages,
}: {
  peers: any[];
  advantages: unknown[];
  disadvantages: unknown[];
}) {
  const { t } = useLang();
  const edgeTone = (edge: string) =>
    edge === "target_better"
      ? "text-bull"
      : edge === "peer_better"
        ? "text-bear"
        : "text-muted-foreground";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("f.peers")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {peers.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          peers.map((peer: any, i: number) => (
            <div key={i} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {peer.peer}
                  {peer.ticker ? (
                    <span className="tabular ml-1.5 text-xs text-muted-foreground">
                      {peer.ticker}
                    </span>
                  ) : null}
                </span>
                <KindBadge kind={peer.kind ?? "inference"} />
              </div>
              <table className="mt-2 w-full text-xs">
                <tbody>
                  {arr<any>(peer.metrics).map((m: any, j: number) => (
                    <tr key={j} className="border-t border-border/60">
                      <td className="py-1 pr-2 text-muted-foreground">
                        {m.metric}
                      </td>
                      <td
                        className={`tabular py-1 pr-2 text-right font-medium ${edgeTone(m.edge ?? "unknown")}`}
                      >
                        {m.target_value ?? "—"}
                      </td>
                      <td className="tabular py-1 text-right text-muted-foreground">
                        {m.peer_value ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {peer.note ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {peer.note}
                </p>
              ) : null}
            </div>
          ))
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-bull">{t("f.advantages")}</p>
            {advantages.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("f.noDiff")}</p>
            ) : (
              advantages.map((c, i) => <ClaimRow key={i} claim={toClaim(c)} />)
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-bear">
              {t("f.disadvantages")}
            </p>
            {disadvantages.length === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              disadvantages.map((c, i) => (
                <ClaimRow key={i} claim={toClaim(c)} />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EarningsFigures({ r }: { r: any }) {
  const { t } = useLang();
  const rows: {
    label: string;
    actual: unknown;
    est: unknown;
    abs: unknown;
    pct: unknown;
  }[] = [
    {
      label: t("e.revenue"),
      actual: r.revenue_actual,
      est: r.revenue_estimate,
      abs: r.revenue_surprise_abs,
      pct: r.revenue_surprise_pct,
    },
    {
      label: t("e.netIncome"),
      actual: r.net_income_actual,
      est: r.net_income_estimate,
      abs: null,
      pct: null,
    },
    {
      label: t("e.eps"),
      actual: r.eps_actual,
      est: r.eps_estimate,
      abs: r.eps_surprise_abs,
      pct: r.eps_surprise_pct,
    },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1 text-left font-normal" />
            <th className="py-1 text-right font-normal">{t("e.actual")}</th>
            <th className="py-1 text-right font-normal">{t("e.estimate")}</th>
            <th className="py-1 text-right font-normal">{t("e.surprise")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border/60">
              <td className="py-1.5 pr-2 text-muted-foreground">{row.label}</td>
              <td className="tabular py-1.5 pr-2 text-right font-medium">
                {(row.actual as string) ?? t("common.noData")}
              </td>
              <td className="tabular py-1.5 pr-2 text-right text-muted-foreground">
                {(row.est as string) ?? t("common.noConsensus")}
              </td>
              <td
                className={`tabular py-1.5 text-right ${toneClass(row.pct as number | null)}`}
              >
                {row.abs || row.pct != null
                  ? `${row.abs ? String(row.abs) : ""}${row.pct != null ? ` (${fmtPct(row.pct as number)})` : ""}`.trim()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClaimRow({ claim }: { claim: Claim }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-relaxed">
          {claim?.text ?? String(claim ?? "")}
        </p>
        <KindBadge kind={claim.kind} confidence={claim.confidence} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {claim.source ?? "—"} · {claim.as_of ?? "—"}
      </p>
    </div>
  );
}

function ShareBars({ title, items }: { title: string; items: Share[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {arr<Share>(items).length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无数据。</p>
        ) : (
          arr<Share>(items).map((it, i) => (
            <div key={i}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{it.name}</span>
                <span className="tabular text-muted-foreground">
                  {it.revenue_share_pct == null
                    ? "—"
                    : `${it.revenue_share_pct.toFixed(1)}%`}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, Math.max(0, it.revenue_share_pct ?? 0))}%`,
                  }}
                />
              </div>
              {it.note ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {it.note}
                </p>
              ) : null}
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {it.kind === "fact" ? "事实" : "推演"} · {it.source ?? "未标注"}{" "}
                · {it.as_of ?? "—"}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SectionBody({
  section,
  payload,
}: {
  section: ResearchSection;
  payload: Record<string, never>;
}) {
  const p = payload as unknown as Record<string, any>;
  const { t } = useLang();

  if (section === "fundamentals") {
    return (
      <div className="space-y-4">
        <ProfileCard profile={p["company_profile"]} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("f.overview")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{p["overview"]}</p>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <ShareBars
            title={t("f.byBusiness")}
            items={arr<Share>(p["business_lines"])}
          />
          <ShareBars
            title={t("f.byProduct")}
            items={arr<Share>(p["product_lines"])}
          />
        </div>
        <ShareBars title={t("f.byRegion")} items={arr<Share>(p["regions"])} />
        <PeerCard
          peers={arr<any>(p["peer_comparison"])}
          advantages={arr(p["differentiation"])}
          disadvantages={arr(p["weaknesses"])}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ["f.model", "business_model"],
              ["f.moat", "moat"],
              ["f.customers", "customers"],
              ["f.suppliers", "suppliers"],
              ["f.competition", "competition"],
            ] as const
          ).map(([label, key]) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-base">{t(label)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {arr(p[key]).map((c, i) => (
                  <ClaimRow key={i} claim={toClaim(c)} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
        <Caveats text={p["caveats"]} />
      </div>
    );
  }

  if (section === "earnings") {
    const next = p["next_report"] ?? {};
    const facts = (p["_facts"] ?? {}) as Record<string, any>;
    const verifiedFacts = arr<any>(facts["earningsFacts"]);
    const forecast = facts["forecast"] as
      Record<string, any> | null | undefined;
    const reactions = arr<any>(facts["reactions"]);
    const reactionFor = (date?: string | null) =>
      date ? reactions.find((x: any) => x.report_date === date) : undefined;
    return (
      <div className="space-y-4">
        {verifiedFacts.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">真实财报数据</CardTitle>
              <CardDescription className="text-xs">
                来源：Nasdaq / SEC
                XBRL；同比按上一年同期申报值计算，缺失字段保留为空
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-1 text-left">期间</th>
                    <th className="py-1 text-right">营收实际</th>
                    <th className="py-1 text-right">营收同比</th>
                    <th className="py-1 text-right">净利润实际</th>
                    <th className="py-1 text-right">净利润同比</th>
                    <th className="py-1 text-right">EPS 实际 / 预期</th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedFacts.map((f: any, i: number) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="py-1.5">
                        {f.period ?? "—"}
                        <br />
                        <span className="text-muted-foreground">
                          {f.report_date ?? "—"}
                        </span>
                      </td>
                      <td className="tabular py-1.5 text-right">
                        {f.revenue_actual ?? "—"}
                      </td>
                      <td
                        className={`tabular py-1.5 text-right ${toneClass(f.revenue_yoy_pct)}`}
                      >
                        {f.revenue_yoy_pct == null
                          ? "—"
                          : fmtPct(f.revenue_yoy_pct)}
                      </td>
                      <td className="tabular py-1.5 text-right">
                        {f.net_income_actual ?? "—"}
                      </td>
                      <td
                        className={`tabular py-1.5 text-right ${toneClass(f.net_income_yoy_pct)}`}
                      >
                        {f.net_income_yoy_pct == null
                          ? "—"
                          : fmtPct(f.net_income_yoy_pct)}
                      </td>
                      <td className="tabular py-1.5 text-right">
                        {f.eps_actual ?? "—"} / {f.eps_estimate ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}
        <div className="space-y-3">
          {arr<any>(p["recent_reports"]).map((r: any, i: number) => {
            const react = reactionFor(r.report_date);
            const d1 = react ? react.d1_pct : r.next_day_move_pct;
            const d3 = react ? react.d3_pct : null;
            const d5 = react ? react.d5_pct : r.five_day_move_pct;
            return (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">{r.period}</CardTitle>
                      <CardDescription className="tabular text-xs">
                        {t("e.reportDate")} {r.report_date ?? "—"} ·{" "}
                        {r.report_timing === "before_open"
                          ? t("e.beforeOpen")
                          : r.report_timing === "after_close"
                            ? t("e.afterClose")
                            : t("e.unknownTiming")}{" "}
                        · {r.beat_or_miss ?? "—"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-[10px] text-muted-foreground">
                          {t("e.nextDay")}
                        </div>
                        <div className={`tabular text-sm ${toneClass(d1)}`}>
                          {fmtPct(d1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">
                          3 日
                        </div>
                        <div className={`tabular text-sm ${toneClass(d3)}`}>
                          {fmtPct(d3)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">
                          {t("e.fiveDay")}
                        </div>
                        <div className={`tabular text-sm ${toneClass(d5)}`}>
                          {fmtPct(d5)}
                        </div>
                      </div>
                      <KindBadge kind={react ? "fact" : r.kind} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <EarningsFigures r={r} />
                  {react?.base_date ? (
                    <p className="tabular text-[11px] text-muted-foreground">
                      财报后波动基准：{react.base_date} 收盘{" "}
                      {fmtNum(react.base_close, 2)}（Yahoo Finance
                      日线计算，可核对）
                    </p>
                  ) : null}
                  <p className="text-sm leading-relaxed">{r.summary}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("common.source")} {r.source ?? t("common.unlabeled")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("e.next")}</CardTitle>
            <CardDescription className="tabular text-xs">
              预计 {forecast?.["expected_date"] ?? next.expected_date ?? "—"}
              （日期置信度{" "}
              {forecast?.["expected_date"]
                ? "high"
                : (next.date_confidence ?? "low")}
              ）
              {forecast?.["fiscal_period"]
                ? ` · 对应季度 ${forecast["fiscal_period"]}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-[11px] text-muted-foreground">
                  {t("e.consensusEps")}
                </div>
                <div className="tabular mt-0.5 font-semibold">
                  {forecast?.["consensus_eps"] != null
                    ? fmtNum(forecast["consensus_eps"], 2)
                    : (next.consensus_eps ?? "—")}
                </div>
                {forecast?.["consensus_eps"] != null ? (
                  <div className="tabular mt-1 text-[10px] text-muted-foreground">
                    区间 {fmtNum(forecast["low_eps"], 2)} ~{" "}
                    {fmtNum(forecast["high_eps"], 2)} ·{" "}
                    {forecast["estimates_count"] ?? "—"} 家分析师 · 近 4 周上调{" "}
                    {forecast["revisions_up"] ?? 0} / 下调{" "}
                    {forecast["revisions_down"] ?? 0}
                  </div>
                ) : null}
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-[11px] text-muted-foreground">
                  {t("e.consensusRev")}
                </div>
                <div className="tabular mt-0.5 font-semibold">
                  {forecast?.["consensus_revenue"] ??
                    next.consensus_revenue ??
                    "无公开一致预期"}
                </div>
              </div>
            </div>
            {forecast ? (
              <p className="text-[11px] text-muted-foreground">
                一致预期来源：{forecast["source"]} ·{" "}
                <a
                  href={forecast["source_url"]}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-primary"
                >
                  查看原始数据
                </a>
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                未取得公开一致预期（该市场分析师覆盖有限），相关字段留空而不推测。
              </p>
            )}
            <div>
              <p className="text-xs font-medium">{t("e.watch")}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {arr<string>(next.watch_items).map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium">
                {t("e.skew")}: {next.skew ?? "—"}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {next.skew_reasoning}
              </p>
            </div>
          </CardContent>
        </Card>
        <Caveats text={p["caveats"]} />
      </div>
    );
  }

  if (section === "cycle") {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">周期定位</CardTitle>
            <CardDescription className="text-xs">
              所属板块：{p["sector"]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-[11px] text-muted-foreground">
                  经济周期阶段
                </div>
                <div className="mt-0.5 text-sm font-semibold">
                  {p["economic_cycle_stage"]}
                </div>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-[11px] text-muted-foreground">
                  行业周期阶段
                </div>
                <div className="mt-0.5 text-sm font-semibold">
                  {p["industry_cycle_stage"]}
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {p["stage_reasoning"]}
            </p>
            <div className="flex flex-wrap gap-4 text-xs">
              <span>
                旺季：
                <span className="text-bull">
                  {(p["strong_months"] ?? []).join("、") || "—"}
                </span>
              </span>
              <span>
                淡季：
                <span className="text-bear">
                  {(p["weak_months"] ?? []).join("、") || "—"}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        <SeasonalityCard
          seasonality={(p["_facts"] ?? {})["seasonality"]}
          aiStats={arr<any>(p["monthly_stats"])}
        />

        <EventTimelineCard
          events={arr<any>((p["_facts"] ?? {})["events"])}
          aiEvents={arr<any>(p["upcoming_events"])}
        />
        <Caveats text={p["caveats"]} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">资金流向摘要</CardTitle>
          <CardDescription className="text-xs">
            窗口 {p["window_days"]} 天
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{p["summary"]}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">机构 / 内部人 / 鲸鱼动向</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(p["records"] ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              该窗口内无可核实记录。
            </p>
          ) : (
            arr<any>(p["records"]).map((r: any, i: number) => (
              <div key={i} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{r.entity}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.entity_type}
                    </Badge>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        r.side === "buy"
                          ? "border-bull/40 bg-bull-muted/40 text-bull"
                          : "border-bear/40 bg-bear-muted/40 text-bear"
                      }`}
                    >
                      {r.side === "buy" ? "买入" : "卖出"}
                    </span>
                  </div>
                  <KindBadge kind={r.kind} confidence={r.confidence} />
                </div>
                <div className="tabular mt-1.5 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
                  <span>日期 {r.date ?? "—"}</span>
                  <span>数量 {r.shares_or_amount ?? "—"}</span>
                  <span>价格 {r.price ?? "—"}</span>
                  <span>金额 {r.total_value ?? "—"}</span>
                </div>
                {r.note ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {r.note}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  来源 {r.source ?? "未标注"}
                  {r.filed_at
                    ? ` · 申报/抓取 ${String(r.filed_at).slice(0, 10)}`
                    : ""}
                  {r.source_url ? (
                    <>
                      {" · "}
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        查看原始披露
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {(p["data_gaps"] ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">数据缺口</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {arr<any>(p["data_gaps"]).map((g: string, i: number) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <Caveats text={p["caveats"]} />
    </div>
  );
}

function Caveats({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      数据说明：{text}
    </p>
  );
}

const MONTH_LABEL = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

type MetricKey =
  "year_high_count" | "year_low_count" | "win_rate_pct" | "avg_return_pct";

const SEASONALITY_METRICS: {
  key: MetricKey;
  label: string;
  kind: "count" | "pct";
}[] = [
  { key: "year_high_count", label: "年度最高价次数", kind: "count" },
  { key: "year_low_count", label: "年度最低价次数", kind: "count" },
  { key: "win_rate_pct", label: "上涨胜率", kind: "pct" },
  { key: "avg_return_pct", label: "平均涨幅", kind: "pct" },
];

function metricValue(m: any, key: MetricKey): number | null {
  const v = m?.[key];
  return typeof v === "number" ? v : null;
}

function fmtMetric(v: number | null, kind: "count" | "pct", key: MetricKey) {
  if (v === null) return "—";
  if (kind === "count") return `${v} 次`;
  if (key === "win_rate_pct") return `${fmtNum(v, 0)}%`;
  return fmtPct(v);
}

/** 月度季节性：真实月线统计（平均涨幅 / 胜率 / 年度最高价与最低价出现次数）。 */
function SeasonalityCard({
  seasonality,
  aiStats,
}: {
  seasonality?: any;
  aiStats: any[];
}) {
  const months: any[] = seasonality?.months ?? [];
  const [metric, setMetric] = useState<MetricKey>("year_high_count");
  const [desc, setDesc] = useState(true);
  const [chartOpen, setChartOpen] = useState(false);

  const active = SEASONALITY_METRICS.find((x) => x.key === metric)!;

  const ranked = useMemo(() => {
    const withVal = months.map((m) => ({ m, v: metricValue(m, metric) }));
    const valid = withVal.filter((x) => x.v !== null);
    const missing = withVal.filter((x) => x.v === null);
    valid.sort((a, b) => {
      const d = desc ? b.v! - a.v! : a.v! - b.v!;
      if (d !== 0) return d;
      return (b.m.avg_return_pct ?? 0) - (a.m.avg_return_pct ?? 0);
    });
    return [...valid, ...missing];
  }, [months, metric, desc]);

  const maxAbsMetric = useMemo(
    () =>
      Math.max(1, ...months.map((m) => Math.abs(metricValue(m, metric) ?? 0))),
    [months, metric],
  );

  if (months.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">历史月度表现</CardTitle>
          <CardDescription className="text-xs">
            未取得足够月线数据，以下为 AI 推演，仅供参考。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {aiStats.map((m: any, i: number) => (
              <div
                key={i}
                className="rounded-md border border-border p-2 text-center"
              >
                <div className="text-[11px] text-muted-foreground">
                  {m.month} 月
                </div>
                <div
                  className={`tabular text-sm font-semibold ${toneClass(m.avg_return_pct)}`}
                >
                  {fmtPct(m.avg_return_pct)}
                </div>
                <div className="tabular text-[10px] text-muted-foreground">
                  胜率 {fmtNum(m.win_rate_pct, 0)}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const lowSample = (seasonality.complete_years ?? 0) < 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          月度最佳表现排行榜（真实月线统计）
        </CardTitle>
        <CardDescription className="tabular text-xs">
          {seasonality.first_year}–{seasonality.last_year} · 完整年度{" "}
          {seasonality.complete_years} 年 · 来源 {seasonality.source}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div className="rounded-md bg-muted/40 p-3">
            <div className="text-[11px] text-muted-foreground">
              最常出现年度最高价的月份
            </div>
            <div className="mt-0.5 text-sm font-semibold text-bull">
              {seasonality.top_year_high_month
                ? `${seasonality.top_year_high_month} 月`
                : "—"}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <div className="text-[11px] text-muted-foreground">
              最常出现年度最低价的月份
            </div>
            <div className="mt-0.5 text-sm font-semibold text-bear">
              {seasonality.top_year_low_month
                ? `${seasonality.top_year_low_month} 月`
                : "—"}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <div className="text-[11px] text-muted-foreground">最强月份</div>
            <div className="mt-0.5 text-sm font-semibold">
              {(seasonality.strongest_months ?? [])
                .map((m: number) => `${m} 月`)
                .join("、") || "—"}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <div className="text-[11px] text-muted-foreground">最弱月份</div>
            <div className="mt-0.5 text-sm font-semibold">
              {(seasonality.weakest_months ?? [])
                .map((m: number) => `${m} 月`)
                .join("、") || "—"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SEASONALITY_METRICS.map((x) => (
            <Button
              key={x.key}
              type="button"
              size="sm"
              variant={x.key === metric ? "default" : "outline"}
              className="h-7 rounded-md px-2 text-[11px]"
              onClick={() => setMetric(x.key)}
            >
              {x.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 rounded-md px-2 text-[11px]"
            onClick={() => setDesc((v) => !v)}
          >
            {desc ? "高 → 低" : "低 → 高"}
          </Button>
        </div>

        <ol className="space-y-1.5">
          {ranked.map(({ m, v }, i) => {
            const rank = v === null ? null : i + 1;
            const width =
              v === null
                ? 0
                : Math.min(100, (Math.abs(v) / maxAbsMetric) * 100);
            const positive = (v ?? 0) >= 0;
            return (
              <li
                key={m.month}
                className="flex items-center gap-3 rounded-md border border-border px-2.5 py-2"
              >
                <span
                  className={`tabular flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${
                    rank !== null && rank <= 3
                      ? "bg-bull/15 text-bull"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {rank ?? "—"}
                </span>
                <span className="w-12 shrink-0 text-xs font-medium">
                  {MONTH_LABEL[m.month - 1]} 月
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`tabular block text-sm font-semibold ${
                      active.kind === "pct" && active.key === "avg_return_pct"
                        ? toneClass(v)
                        : "text-foreground"
                    }`}
                  >
                    {fmtMetric(v, active.kind, active.key)}
                  </span>
                  <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-md bg-muted/50">
                    <span
                      className={`block h-full rounded-md ${positive ? "bg-bull" : "bg-bear"}`}
                      style={{ width: `${width}%` }}
                    />
                  </span>
                </span>
                <span className="tabular hidden shrink-0 text-right text-[10px] leading-tight text-muted-foreground sm:block">
                  平均 {fmtPct(m.avg_return_pct)} · 胜率{" "}
                  {fmtNum(m.win_rate_pct, 0)}%
                  <br />
                  年高 {m.year_high_count ?? 0} 次 · 年低{" "}
                  {m.year_low_count ?? 0} 次 · 样本 {m.samples ?? 0}
                </span>
              </li>
            );
          })}
        </ol>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 rounded-md px-2 text-[11px]"
          onClick={() => setChartOpen((v) => !v)}
        >
          {chartOpen ? "收起图表" : "展开图表"}
        </Button>

        {chartOpen ? (
          <div className="space-y-4">
            {lowSample ? (
              <p className="text-[11px] text-muted-foreground">
                样本仅 {seasonality.complete_years}{" "}
                个完整年度，季节性结论参考价值有限。
              </p>
            ) : null}

            <div className="flex items-end gap-1.5">
              {months.map((m: any) => {
                const v = metricValue(m, metric);
                const h =
                  v === null
                    ? 0
                    : Math.max(2, (Math.abs(v) / maxAbsMetric) * 96);
                return (
                  <div
                    key={m.month}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1"
                  >
                    <span className="tabular text-[9px] text-muted-foreground">
                      {v === null ? "—" : fmtMetric(v, active.kind, active.key)}
                    </span>
                    <span
                      className={`w-full rounded-md ${(v ?? 0) >= 0 ? "bg-bull/70" : "bg-bear/70"}`}
                      style={{ height: `${h}px` }}
                      title={`${m.month} 月 · 平均 ${fmtPct(m.avg_return_pct)} · 胜率 ${fmtNum(
                        m.win_rate_pct,
                        0,
                      )}% · 年度最高 ${m.year_high_count ?? 0} 次 · 年度最低 ${
                        m.year_low_count ?? 0
                      } 次 · 样本 ${m.samples ?? 0} 个月`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {MONTH_LABEL[m.month - 1]}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">月份</th>
                    <th className="py-1 pr-3">平均涨幅</th>
                    <th className="py-1 pr-3">上涨胜率</th>
                    <th className="py-1 pr-3">年度最高价次数</th>
                    <th className="py-1 pr-3">年度最低价次数</th>
                    <th className="py-1 pr-3">最好 / 最差单月</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m: any) => (
                    <tr key={m.month} className="border-t border-border">
                      <td className="py-1 pr-3">{m.month} 月</td>
                      <td
                        className={`tabular py-1 pr-3 ${toneClass(m.avg_return_pct)}`}
                      >
                        {fmtPct(m.avg_return_pct)}
                      </td>
                      <td className="tabular py-1 pr-3">
                        {fmtNum(m.win_rate_pct, 0)}%
                      </td>
                      <td className="tabular py-1 pr-3">
                        {m.year_high_count ?? 0}
                      </td>
                      <td className="tabular py-1 pr-3">
                        {m.year_low_count ?? 0}
                      </td>
                      <td className="tabular py-1 pr-3 text-muted-foreground">
                        {fmtPct(m.best_return_pct)} /{" "}
                        {fmtPct(m.worst_return_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** 前后一个月事件时间轴：真实发布时间 + 原文链接，按用户所选时区显示。 */
function EventTimelineCard({
  events,
  aiEvents,
}: {
  events: any[];
  aiEvents: any[];
}) {
  const { tz: zone, shortLabel: zl } = useTimezone();
  const kindLabel: Record<string, string> = {
    earnings: "财报",
    news: "公司新闻",
    macro: "宏观数据",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">前后一个月重大事件</CardTitle>
        <CardDescription className="text-xs">
          时间按 {zl} 显示；仅日期的条目表示来源未公布具体时刻。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            未取得可核实的公开事件记录。
          </p>
        ) : (
          events.map((e: any, i: number) => (
            <div key={i} className="rounded-md bg-muted/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-xs font-semibold text-primary">
                  {e.date_only
                    ? `${e.at}（仅日期）`
                    : `${formatFullInZone(e.at, zone)} ${zl}`}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {kindLabel[e.kind] ?? e.kind}
                </Badge>
                {e.future ? (
                  <Badge variant="secondary" className="text-[10px]">
                    未来
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm leading-relaxed">{e.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {e.future
                  ? `未发生事件预测：${e.forecast_impact === "bullish" ? "利多" : e.forecast_impact === "bearish" ? "利空" : "中性"}`
                  : `发布后下一交易日涨跌：${e.price_change_24h_pct == null ? "—" : `${e.price_change_24h_pct >= 0 ? "+" : ""}${e.price_change_24h_pct.toFixed(2)}%`}`}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                来源 {e.source}
                {e.url ? (
                  <>
                    {" · "}
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-primary"
                    >
                      查看原文
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          ))
        )}
        {aiEvents.length > 0 ? (
          <div className="border-t border-border pt-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              AI 影响逻辑（推演）
            </p>
            <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
              {aiEvents.map((e: any, i: number) => (
                <li key={i}>
                  <span className="tabular">{e.date}</span> · {e.event} · 方向{" "}
                  {e.direction} — {e.logic}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
