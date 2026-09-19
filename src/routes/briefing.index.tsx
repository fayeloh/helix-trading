import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  ClipboardList,
  Globe2,
  Newspaper,
  RefreshCw,
  Zap,
} from "lucide-react";

import { ExecutiveSummary } from "@/components/macro/ExecutiveSummary";
import { GlobalMarketOverview } from "@/components/macro/GlobalMarketOverview";
import { MacroBriefingHeader } from "@/components/macro/MacroBriefingHeader";
import { MacroCalendar } from "@/components/macro/MacroCalendar";
import { SectionCard } from "@/components/macro/SectionCard";
import { SectorRotationPanel } from "@/components/macro/SectorRotation";
import { TopHeadlines } from "@/components/macro/TopHeadlines";
import { TrendSignals } from "@/components/macro/TrendSignals";
import { useMacroBriefing } from "@/hooks/useMacroBriefing";
import { useBaseCurrency } from "@/lib/base-currency";
import { useTimezone } from "@/lib/timezone";

export const Route = createFileRoute("/briefing/")({
  head: () => ({
    meta: [
      { title: "每日宏观简报：3 分钟读懂当日市场 — Helix Trading" },
      {
        name: "description",
        content:
          "每日宏观财经简报：执行摘要、全球市场概览、板块轮动、AI 趋势信号、宏观日历与头条影响分析，辅助判断而非操作建议。",
      },
      { property: "og:title", content: "每日宏观简报 — Helix Trading" },
      {
        property: "og:description",
        content: "股指、汇率、大宗商品、债券收益率与当日关键事件，一屏读完。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MacroBriefingPage,
});

function MacroBriefingPage() {
  const { data, isLoading, isError, isFetching, refetch } = useMacroBriefing();
  const overview = data?.global_market_overview;
  const rotation = data?.sector_rotation;
  const signals = data?.ai_trend_signals;
  const calendar = data?.macro_calendar;
  const headlines = data?.top_headlines;
  const { shortLabel } = useTimezone();
  const { currency } = useBaseCurrency();
  // 交易日按美东口径显示（不做跨时区换算，否则收盘时刻会被推到次日）。
  const scope = `· 计价：${currency}`;
  const day = data?.date ?? "";
  const fetchedAt = data?.fetched_at;
  const src = data?.sources;
  const demo = data?.demo_modules ?? [];
  const demoHint = (key: (typeof demo)[number], base: string) =>
    demo.includes(key) ? `${base}（示例数据，尚未接入实时源）` : base;


  return (
    <div className="min-h-screen bg-background">
      <MacroBriefingHeader
        date={data?.date}
        fetchedAt={fetchedAt}
        onRefresh={() => {
          void refetch();
        }}
        refreshing={isFetching}
      />

      <main className="mx-auto max-w-5xl px-4 py-4 pb-16">
        <div className="grid gap-4 xl:grid-cols-[62fr_38fr] xl:items-start">
          <div className="space-y-3">
            <SectionCard
              icon={ClipboardList}
              title="执行摘要"
              hint="只看这一块就够"
              timeLabel={`数据时间：${day} 美股收盘（美东）${scope}`}
              fetchedAt={fetchedAt}
              sources={src?.summary ?? []}
              defaultOpen
              loading={isLoading}
              unavailable={isError || !data}
            >
              {data ? <ExecutiveSummary data={data} /> : null}
            </SectionCard>

            <SectionCard
              icon={Newspaper}
              title="头条新闻与影响分析"
              hint="24 小时内最重要的新闻（实时抓取，英文标题已译为中文）"
              timeLabel={`发布时间已换算为 ${shortLabel} · 计价：${currency}`}
              fetchedAt={fetchedAt}
              sources={src?.top_headlines ?? []}
              loading={isLoading}
              unavailable={isError || !headlines?.length}
            >
              {headlines ? <TopHeadlines data={headlines} /> : null}
            </SectionCard>
          </div>

          <div className="space-y-3 xl:sticky xl:top-[148px]">
            <SectionCard
              icon={Globe2}
              title="全球市场概览"
              hint="股指 / 汇率 / 大宗商品 / 债券收益率"
              timeLabel={`数据时间：${day} 美股收盘（美东）${scope}`}
              fetchedAt={fetchedAt}
              sources={src?.global_market_overview ?? []}
              defaultOpen
              loading={isLoading}
              unavailable={isError || !overview}
            >
              {overview ? <GlobalMarketOverview data={overview} /> : null}
            </SectionCard>

            <SectionCard
              icon={RefreshCw}
              title="板块与主题轮动"
              hint="可切换美股 / 港股，查看领涨与领跌板块"
              timeLabel={`数据时间：${day} 美股收盘（美东）${scope}`}
              fetchedAt={fetchedAt}
              sources={src?.sector_rotation ?? []}
              loading={isLoading}
              unavailable={isError || !rotation}
            >
              {rotation ? (
                <SectorRotationPanel data={rotation} byMarket={data?.sector_rotation_by_market} />
              ) : null}
            </SectionCard>


            <SectionCard
              icon={Zap}
              title="AI 趋势信号"
              hint={demoHint("ai_trend_signals", "主题、方向、置信度（模型有多确定）与触发依据")}
              timeLabel={`生成时间：${day}（美东交易日）${scope}`}
              fetchedAt={fetchedAt}
              sources={src?.ai_trend_signals ?? []}
              loading={isLoading}
              unavailable={isError || !signals?.length}
            >
              {signals ? <TrendSignals data={signals} /> : null}
            </SectionCard>

            <SectionCard
              icon={CalendarClock}
              title="宏观财经日历"
              hint={demoHint("macro_calendar", "未来 48 小时事件")}
              timeLabel={`事件时间已换算为 ${shortLabel} · 计价：${currency}`}
              fetchedAt={fetchedAt}
              sources={src?.macro_calendar ?? []}
              loading={isLoading}
              unavailable={isError || !calendar?.length}
            >
              {calendar ? <MacroCalendar data={calendar} /> : null}
            </SectionCard>
          </div>
        </div>

        <p className="pt-4 text-xs leading-relaxed text-faint">
          本简报用于辅助判断，不构成投资建议，也不代表任何买卖操作指令。
        </p>
      </main>

    </div>
  );
}
