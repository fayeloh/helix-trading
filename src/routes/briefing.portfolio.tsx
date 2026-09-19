import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookmarkPlus, CalendarClock, Clock, LineChart, Newspaper, Sparkles, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { KindBadge } from "@/components/Disclaimer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { generateBriefing, listBriefings } from "@/lib/briefing.functions";
import { recordEventImpact } from "@/lib/impacts.functions";
import { useLang, type Lang } from "@/lib/i18n";

type Impact = {
  target: string;
  direction: string;
  reasoning: string;
  kind: string;
  confidence: string | null;
};

type Headline = {
  title: string;
  published_at: string;
  source: string | null;
  takeaway: string;
  importance: string;
  sectors?: string[];
  action_note?: string;
  impacts: Impact[];
};

type EconEvent = {
  event: string;
  release_time: string;
  region: string;
  consensus: string | null;
  previous: string | null;
  importance: string;
  sectors?: string[];
  action_note?: string;
  impacts: Impact[];
};

type EarningsItem = {
  company: string;
  symbol: string | null;
  date: string;
  timing: string;
  in_portfolio: boolean;
  sectors?: string[];
  note: string;
};

type WatchOut = { label: string; detail: string; trigger: string };

type BasePayload = {
  summary: string;
  as_of?: string;
  caveats: string;
  headlines?: Headline[];
  econ_events?: EconEvent[];
  earnings_today?: EarningsItem[];
  watch_outs?: WatchOut[];
};

type PortfolioPayload = BasePayload & {
  tailwinds?: Impact[];
  headwinds?: Impact[];
  watch_points?: { symbol: string; observation: string; trigger: string; kind: string; confidence: string | null }[];
  calendar?: { date: string; event: string; affected: string; potential_impact: string; kind: string; confidence: string | null }[];
  risk_flags?: { label: string; detail: string }[];
};

type BriefingRow = {
  id: string;
  briefing_type: string;
  briefing_date: string;
  generated_at: string;
  account_id: string | null;
  payload: unknown;
};

const L = {
  zh: {
    title: "每日简报",
    sub: "实时事件驱动：今日头条 → 当日经济数据 → 财报日历 → 注意事项。时间以 Asia/Shanghai 展示并标注 ET",
    tabMacro: "A · 宏观实时简报",
    tabPortfolio: "B · 持仓定制简报",
    macroLabel: "宏观全球实时简报",
    portfolioLabel: "持仓定制化实时简报",
    asOf: "数据截至",
    never: "尚未生成",
    minutesAgo: "分钟前",
    justNow: "刚刚",
    hoursAgo: "小时前",
    gen: "生成 / 读取最新",
    genning: "生成中…",
    force: "立即刷新",
    reuse: "15 分钟内复用缓存",
    empty: "还没有这份简报，点击上方按钮生成。生成结果会入库，可随时回看。",
    overview: "当下市场概览",
    headlines: "今日头条",
    econ: "当日经济数据与央行事件",
    earnings: "当日财报日历",
    watchOuts: "注意事项",
    consensus: "市场预期",
    previous: "前值",
    source: "来源",
    trigger: "重新评估触发条件",
    inPortfolio: "持仓相关",
    tail: "持仓利好项",
    head: "持仓利空项",
    points: "观察要点",
    pointsHint: "仅为观察项与失效触发条件，不构成任何操作指令",
    calendar: "未来交易日事件日历",
    risk: "组合风险提示",
    caveats: "数据说明",
    ok: "简报已生成",
    fail: "生成失败",
    none: "本次未检索到相关条目。",
    unknownTime: "时间未知",
    sectors: "影响板块",
    actionNote: "注意要点",
    record: "记录影响",
    recording: "记录中…",
    recorded: "已加入影响复盘",
    recordFail: "记录失败",
    timeline: "今日时间线",
    timelineEmpty: "暂无带时间的事件。",
    showMore: "展开全部",
    showLess: "收起",
    et: "ET",
    reviewLink: "影响复盘",
  },
  en: {
    title: "Daily briefing",
    sub: "Real-time event flow: headlines → economic releases → earnings calendar → watch-outs. Times shown in your display timezone with ET",
    tabMacro: "A · Macro live briefing",
    tabPortfolio: "B · Portfolio briefing",
    macroLabel: "Global macro live briefing",
    portfolioLabel: "Portfolio-specific live briefing",
    asOf: "Data as of",
    never: "Not generated yet",
    minutesAgo: "min ago",
    justNow: "just now",
    hoursAgo: "h ago",
    gen: "Generate / load latest",
    genning: "Generating…",
    force: "Refresh now",
    reuse: "cached for 15 min",
    empty: "No briefing yet — use the button above. Results are stored and can be revisited.",
    overview: "Market snapshot",
    headlines: "Today's headlines",
    econ: "Economic releases & central banks",
    earnings: "Earnings due today",
    watchOuts: "Watch-outs",
    consensus: "Consensus",
    previous: "Previous",
    source: "Source",
    trigger: "Re-evaluate when",
    inPortfolio: "In portfolio",
    tail: "Tailwinds",
    head: "Headwinds",
    points: "Observation points",
    pointsHint: "Observations and invalidation triggers only — not trade instructions",
    calendar: "Upcoming session calendar",
    risk: "Portfolio risk flags",
    caveats: "Data notes",
    ok: "Briefing generated",
    fail: "Generation failed",
    none: "No relevant items retrieved this run.",
    unknownTime: "time unknown",
    sectors: "Sectors affected",
    actionNote: "Watch note",
    record: "Track impact",
    recording: "Saving…",
    recorded: "Added to impact review",
    recordFail: "Could not track",
    timeline: "Today's timeline",
    timelineEmpty: "No timestamped events yet.",
    showMore: "Show all",
    showLess: "Collapse",
    et: "ET",
    reviewLink: "Impact review",
  },
} as const;

export const Route = createFileRoute("/briefing/portfolio")({
  head: () => ({
    meta: [
      { title: "每日简报：实时头条与持仓定制 — Helix Trading" },
      {
        name: "description",
        content:
          "实时抓取当日财经头条、经济数据公布时间与财报日历，标注发布时间与来源，并推演对板块与持仓的利多利空与观察要点。",
      },
      { property: "og:title", content: "每日实时简报 — Helix Trading" },
      { property: "og:description", content: "当日头条 + 事件时间 + 板块影响 + 持仓观察要点。" },
    ],
  }),
  component: BriefingPage,
});

function relTime(iso: string, lang: Lang): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const t = L[lang];
  if (mins < 1) return t.justNow;
  if (mins < 60) return `${mins} ${t.minutesAgo}`;
  return `${Math.round(mins / 60)} ${t.hoursAgo}`;
}

function BriefingPage() {
  const { user } = useAuth();
  const { activeAccountId, activeAccount } = useAccounts();
  const qc = useQueryClient();
  const listFn = useServerFn(listBriefings);
  const genFn = useServerFn(generateBriefing);
  const { lang } = useLang();
  const t = L[lang];

  const list = useQuery({
    queryKey: ["briefings", activeAccountId],
    enabled: !!user,
    // 实时性：每 5 分钟静默重取（AI 侧 15 分钟窗口内直接复用缓存）
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => (await listFn({ data: { accountId: activeAccountId } })) as BriefingRow[],
  });

  const generate = useMutation({
    mutationFn: async (vars: { type: "macro" | "portfolio"; force: boolean }) =>
      await genFn({ data: { accountId: activeAccountId, type: vars.type, lang, force: vars.force } }),
    onSuccess: () => {
      toast.success(t.ok);
      qc.invalidateQueries({ queryKey: ["briefings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.fail),
  });

  const recordFn = useServerFn(recordEventImpact);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const record = useMutation({
    mutationFn: async (vars: { key: string; briefingId: string | null; data: RecordPayload }) => {
      setRecordingKey(vars.key);
      return await recordFn({
        data: {
          accountId: activeAccountId,
          briefingId: vars.briefingId,
          ...vars.data,
        },
      });
    },
    onSuccess: () => {
      toast.success(t.recorded);
      qc.invalidateQueries({ queryKey: ["event-impacts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.recordFail),
    onSettled: () => setRecordingKey(null),
  });

  const rows = list.data ?? [];
  const macro = rows.find((r) => r.briefing_type === "macro");
  const portfolio = rows.find(
    (r) => r.briefing_type === "portfolio" && r.account_id === activeAccountId,
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeAccount?.name ? `${activeAccount.name} · ` : ""}
            {t.sub}
          </p>
        </div>
        <Link
          to="/impacts"
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <LineChart className="size-3.5" />
          {t.reviewLink}
        </Link>

        <Tabs defaultValue="macro">
          <TabsList>
            <TabsTrigger value="macro" className="text-xs">
              {t.tabMacro}
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="text-xs">
              {t.tabPortfolio}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="macro" className="mt-4 space-y-4">
            <GenerateBar
              label={t.macroLabel}
              generatedAt={macro?.generated_at}
              pending={generate.isPending}
              lang={lang}
              onGenerate={(force) => generate.mutate({ type: "macro", force })}
            />
            {macro ? (
              <>
                <LiveSections
                  payload={macro.payload as BasePayload}
                  lang={lang}
                  recordingKey={recordingKey}
                  onRecord={(key, data) => record.mutate({ key, briefingId: macro.id, data })}
                />
                <Caveats payload={macro.payload as BasePayload} lang={lang} />
              </>
            ) : (
              <EmptyHint text={t.empty} />
            )}
          </TabsContent>

          <TabsContent value="portfolio" className="mt-4 space-y-4">
            <GenerateBar
              label={t.portfolioLabel}
              generatedAt={portfolio?.generated_at}
              pending={generate.isPending}
              lang={lang}
              onGenerate={(force) => generate.mutate({ type: "portfolio", force })}
            />
            {portfolio ? (
              <>
                <LiveSections
                  payload={portfolio.payload as BasePayload}
                  lang={lang}
                  recordingKey={recordingKey}
                  onRecord={(key, data) => record.mutate({ key, briefingId: portfolio.id, data })}
                />
                <PortfolioExtras payload={portfolio.payload as PortfolioPayload} lang={lang} />
                <Caveats payload={portfolio.payload as BasePayload} lang={lang} />
              </>
            ) : (
              <EmptyHint text={t.empty} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function GenerateBar({
  label,
  generatedAt,
  pending,
  lang,
  onGenerate,
}: {
  label: string;
  generatedAt?: string | undefined;
  pending: boolean;
  lang: Lang;
  onGenerate: (force: boolean) => void;
}) {
  const t = L[lang];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {generatedAt
            ? `${t.asOf} ${new Date(generatedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")} · ${relTime(generatedAt, lang)} · ${t.reuse}`
            : t.never}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onGenerate(false)} disabled={pending}>
          <Sparkles className="mr-1 size-3.5" />
          {pending ? t.genning : t.gen}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onGenerate(true)} disabled={pending}>
          {t.force}
        </Button>
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    bullish: { text: "利多 / bullish", cls: "border-bull/40 bg-bull-muted/40 text-bull" },
    bearish: { text: "利空 / bearish", cls: "border-bear/40 bg-bear-muted/40 text-bear" },
    neutral: { text: "中性 / neutral", cls: "border-border bg-muted text-muted-foreground" },
    unknown: { text: "unknown", cls: "border-border bg-muted text-muted-foreground" },
  };
  const v = map[direction] ?? map["unknown"]!;
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${v.cls}`}>
      {v.text}
    </span>
  );
}

function ImpactRows({ items }: { items: Impact[] }) {
  return (
    <>
      {(items ?? []).map((im, j) => (
        <div key={j} className="rounded-md bg-muted/40 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">{im.target}</span>
            <DirectionBadge direction={im.direction} />
            <KindBadge kind={im.kind} confidence={im.confidence} />
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{im.reasoning}</p>
        </div>
      ))}
    </>
  );
}

function SectorTags({ sectors, label }: { sectors?: string[] | undefined; label: string }) {
  if (!sectors || sectors.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {sectors.map((s, i) => (
        <span key={i} className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px]">
          {s}
        </span>
      ))}
    </div>
  );
}

function TimeLine({ text, lang }: { text: string | undefined; lang: Lang }) {
  const t = L[lang];
  const known = text && text !== "unknown";
  return (
    <span className="tabular text-[11px] text-muted-foreground">
      {known ? text : t.unknownTime}
    </span>
  );
}

type RecordPayload = {
  eventKind: "headline" | "econ" | "earnings";
  title: string;
  publishedAt: string | null;
  source: string | null;
  direction: string;
  sectors: string[];
  targets: { target: string; direction?: string; reasoning?: string }[];
  extraSymbols: string[];
};

function RecordButton({
  lang,
  pending,
  onClick,
}: {
  lang: Lang;
  pending: boolean;
  onClick: () => void;
}) {
  const t = L[lang];
  return (
    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" disabled={pending} onClick={onClick}>
      <BookmarkPlus className="mr-1 size-3.5" />
      {pending ? t.recording : t.record}
    </Button>
  );
}

function EventCard({
  title,
  time,
  meta,
  badges,
  body,
  sectors,
  actionNote,
  impacts,
  lang,
  onRecord,
  recording,
}: {
  title: string;
  time: string | undefined;
  meta?: string | undefined;
  badges?: ReactNode;
  body?: string | undefined;
  sectors?: string[] | undefined;
  actionNote?: string | undefined;
  impacts?: Impact[] | undefined;
  lang: Lang;
  onRecord?: (() => void) | undefined;
  recording?: boolean | undefined;
}) {
  const t = L[lang];
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-[220px] flex-1">
          <p className="text-sm font-medium leading-snug">{title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <TimeLine text={time} lang={lang} />
            {meta ? <span className="text-[11px] text-muted-foreground">· {meta}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {badges}
          {onRecord ? <RecordButton lang={lang} pending={!!recording} onClick={onRecord} /> : null}
        </div>
      </div>

      {body ? <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/85">{body}</p> : null}
      <SectorTags sectors={sectors} label={t.sectors} />
      {actionNote ? (
        <p className="mt-2 rounded-md border-l-2 border-warn/60 bg-warn-muted/20 px-2.5 py-1.5 text-[11px] leading-relaxed">
          <span className="font-medium">{t.actionNote}：</span>
          {actionNote}
        </p>
      ) : null}
      {impacts && impacts.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          <ImpactRows items={impacts} />
        </div>
      ) : null}
    </div>
  );
}

function Collapsible({
  children,
  count,
  lang,
}: {
  children: ReactNode[];
  count: number;
  lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const t = L[lang];
  const shown = open ? children : children.slice(0, 5);
  return (
    <>
      {shown}
      {count > 5 ? (
        <Button variant="ghost" size="sm" className="text-[11px]" onClick={() => setOpen((v) => !v)}>
          {open ? t.showLess : `${t.showMore} (${count})`}
        </Button>
      ) : null}
    </>
  );
}

function timeKey(s: string | undefined): string {
  if (!s || s === "unknown") return "~";
  return s;
}

function LiveSections({
  payload,
  lang,
  onRecord,
  recordingKey,
}: {
  payload: BasePayload;
  lang: Lang;
  onRecord: (key: string, data: RecordPayload) => void;
  recordingKey: string | null;
}) {
  const t = L[lang];
  const headlines = payload.headlines ?? [];
  const econ = payload.econ_events ?? [];
  const earnings = payload.earnings_today ?? [];
  const watchOuts = payload.watch_outs ?? [];

  const timeline = [
    ...econ.map((e) => ({ time: e.release_time, label: e.event, tag: t.econ })),
    ...earnings.map((e) => ({
      time: e.date,
      label: `${e.company}${e.symbol ? ` (${e.symbol})` : ""}`,
      tag: t.earnings,
    })),
  ]
    .filter((x) => x.time && x.time !== "unknown")
    .sort((a, b) => timeKey(a.time).localeCompare(timeKey(b.time)))
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.overview}</CardTitle>
          {payload.as_of ? (
            <CardDescription className="tabular text-xs">
              {t.asOf} {payload.as_of}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-foreground/90">{payload.summary}</p>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <CalendarClock className="size-3.5 text-primary" />
              {t.timeline}
            </p>
            {timeline.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{t.timelineEmpty}</p>
            ) : (
              <ol className="space-y-1">
                {timeline.map((x, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-2 text-[11px]">
                    <span className="tabular font-semibold text-primary">{x.time}</span>
                    <span className="text-foreground/85">{x.label}</span>
                    <span className="text-muted-foreground">· {x.tag}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="size-4 text-primary" />
            {t.headlines}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {headlines.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.none}</p>
          ) : (
            <Collapsible count={headlines.length} lang={lang}>
              {headlines.map((h, i) => (
                <EventCard
                  key={`h${i}`}
                  lang={lang}
                  title={h.title}
                  time={h.published_at}
                  meta={h.source ? `${t.source}：${h.source}` : undefined}
                  body={h.takeaway}
                  sectors={h.sectors}
                  actionNote={h.action_note}
                  impacts={h.impacts ?? []}
                  badges={
                    <Badge variant={h.importance === "high" ? "default" : "secondary"} className="text-[10px]">
                      {h.importance}
                    </Badge>
                  }
                  recording={recordingKey === `h${i}`}
                  onRecord={() =>
                    onRecord(`h${i}`, {
                      eventKind: "headline",
                      title: h.title,
                      publishedAt: h.published_at ?? null,
                      source: h.source ?? null,
                      direction: h.impacts?.[0]?.direction ?? "unknown",
                      sectors: h.sectors ?? [],
                      targets: (h.impacts ?? []).map((im) => ({
                        target: im.target,
                        direction: im.direction,
                        reasoning: im.reasoning,
                      })),
                      extraSymbols: [],
                    })
                  }
                />
              ))}
            </Collapsible>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-primary" />
            {t.econ}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {econ.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.none}</p>
          ) : (
            <Collapsible count={econ.length} lang={lang}>
              {econ.map((e, i) => (
                <EventCard
                  key={`e${i}`}
                  lang={lang}
                  title={e.event}
                  time={e.release_time}
                  meta={e.region}
                  sectors={e.sectors}
                  actionNote={e.action_note}
                  impacts={e.impacts ?? []}
                  badges={
                    <>
                      {e.consensus ? (
                        <Badge variant="outline" className="tabular text-[10px]">
                          {t.consensus} {e.consensus}
                        </Badge>
                      ) : null}
                      {e.previous ? (
                        <Badge variant="outline" className="tabular text-[10px]">
                          {t.previous} {e.previous}
                        </Badge>
                      ) : null}
                      <Badge variant={e.importance === "high" ? "default" : "secondary"} className="text-[10px]">
                        {e.importance}
                      </Badge>
                    </>
                  }
                  recording={recordingKey === `e${i}`}
                  onRecord={() =>
                    onRecord(`e${i}`, {
                      eventKind: "econ",
                      title: e.event,
                      publishedAt: e.release_time ?? null,
                      source: e.region ?? null,
                      direction: e.impacts?.[0]?.direction ?? "unknown",
                      sectors: e.sectors ?? [],
                      targets: (e.impacts ?? []).map((im) => ({
                        target: im.target,
                        direction: im.direction,
                        reasoning: im.reasoning,
                      })),
                      extraSymbols: [],
                    })
                  }
                />
              ))}
            </Collapsible>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.earnings}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {earnings.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.none}</p>
          ) : (
            <Collapsible count={earnings.length} lang={lang}>
              {[...earnings]
                .sort((a, b) => Number(b.in_portfolio) - Number(a.in_portfolio))
                .map((e, i) => (
                  <EventCard
                    key={`r${i}`}
                    lang={lang}
                    title={`${e.company}${e.symbol ? ` · ${e.symbol}` : ""}`}
                    time={e.date}
                    sectors={e.sectors}
                    actionNote={e.note}
                    badges={
                      <>
                        <Badge variant="outline" className="text-[10px]">
                          {e.timing}
                        </Badge>
                        {e.in_portfolio ? <Badge className="text-[10px]">{t.inPortfolio}</Badge> : null}
                      </>
                    }
                    recording={recordingKey === `r${i}`}
                    onRecord={() =>
                      onRecord(`r${i}`, {
                        eventKind: "earnings",
                        title: `${e.company}${e.symbol ? ` (${e.symbol})` : ""}`,
                        publishedAt: e.date ?? null,
                        source: null,
                        direction: "unknown",
                        sectors: e.sectors ?? [],
                        targets: e.symbol ? [{ target: e.symbol }] : [],
                        extraSymbols: e.symbol ? [e.symbol] : [],
                      })
                    }
                  />
                ))}
            </Collapsible>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TriangleAlert className="size-4 text-warn" />
            {t.watchOuts}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {watchOuts.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.none}</p>
          ) : (
            watchOuts.map((w, i) => (
              <div key={i} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{w.label}</p>
                <p className="mt-1 text-[12px] text-foreground/85">{w.detail}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.trigger}：{w.trigger}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function PortfolioExtras({ payload, lang }: { payload: PortfolioPayload; lang: Lang }) {
  const t = L[lang];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-bull">{t.tail}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ImpactRows items={payload.tailwinds ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-bear">{t.head}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ImpactRows items={payload.headwinds ?? []} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.points}</CardTitle>
          <CardDescription className="text-xs">{t.pointsHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {(payload.watch_points ?? []).map((w, i) => (
            <div key={i} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-xs font-semibold">{w.symbol}</span>
                <KindBadge kind={w.kind} confidence={w.confidence} />
              </div>
              <p className="mt-1 text-sm">{w.observation}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.trigger}：{w.trigger}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-primary" />
            {t.calendar}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {(payload.calendar ?? []).map((c, i) => (
            <div key={i} className="flex flex-wrap gap-3 rounded-md bg-muted/40 p-3">
              <span className="tabular text-xs font-semibold text-primary">{c.date}</span>
              <div className="min-w-[220px] flex-1">
                <p className="text-sm">{c.event}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {c.affected} — {c.potential_impact}
                </p>
              </div>
              <KindBadge kind={c.kind} confidence={c.confidence} />
            </div>
          ))}
        </CardContent>
      </Card>

      {(payload.risk_flags ?? []).length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-warn" />
              {t.risk}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(payload.risk_flags ?? []).map((r, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{r.label}：</span>
                <span className="text-muted-foreground">{r.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Caveats({ payload, lang }: { payload: BasePayload; lang: Lang }) {
  if (!payload.caveats) return null;
  return (
    <p className="text-[11px] text-muted-foreground">
      {L[lang].caveats}：{payload.caveats}
    </p>
  );
}
