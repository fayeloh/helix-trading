import { useQuery } from "@tanstack/react-query";

import {
  getMacroBriefingData,
  getMacroBriefingNews,
} from "@/lib/macro-briefing.functions";
import type { MacroBriefing, ModuleKey } from "@/lib/macro-briefing.types";

/**
 * 数据层：全部模块均来自实时公开数据源。
 * 行情/板块 = Yahoo Finance（与指数看板同源）；头条 = Google News；宏观日历与财报 = Nasdaq 日历。
 */
async function fetchMacroBriefing(): Promise<MacroBriefing> {
  const [live, news] = await Promise.all([getMacroBriefingData(), getMacroBriefingNews()]);

  // 行情全线取数失败时抛错，让 react-query 重试，而不是把「暂不可用」当成结果缓存起来。
  if (!live.global_market_overview) {
    throw new Error("市场数据暂时取不到，正在重试");
  }

  // 头条与日历为真实抓取源，取不到就是「暂时取不到」，不是示例数据。
  const demo: ModuleKey[] = [];


  return {
    date: live.date,
    fetched_at: live.fetched_at,
    global_market_overview: live.global_market_overview,
    ...(live.sector_rotation ? { sector_rotation: live.sector_rotation } : {}),
    sector_rotation_by_market: {
      ...(live.sector_rotation ? { us: live.sector_rotation } : {}),
      ...(live.sector_rotation_hk ? { hk: live.sector_rotation_hk } : {}),
    },
    ai_trend_signals: live.trend_signals ?? [],
    macro_calendar: news.calendar,
    top_headlines: news.headlines,
    demo_modules: demo,
    sources: {
      summary: [
        {
          name: "Helix 汇总引擎",
          covers: "基于实时行情与实时头条自动生成",
          updated_at: live.fetched_at,
        },
      ],
      global_market_overview: [
        {
          name: "Yahoo Finance",
          covers: "股指 / VIX（恐慌指数）/ 汇率 / 大宗商品 / 美债收益率",
          updated_at: live.fetched_at,
          url: "https://finance.yahoo.com/markets/",
        },
      ],
      sector_rotation: [
        {
          name: "Yahoo Finance 行业 ETF（美股）",
          covers: "美股行业板块当日涨跌幅",
          updated_at: live.fetched_at,
          url: "https://finance.yahoo.com/sectors/",
        },
        {
          name: "恒生行业分类指数 / 恒生科技（港股）",
          covers: "港股行业板块当日涨跌幅",
          updated_at: live.fetched_at,
          url: "https://www.hsi.com.hk/schi",
        },
      ],
      ai_trend_signals: [
        {
          name: "Helix 信号引擎",
          covers: "基于当日行情（指数 / VIX / 美元 / 收益率 / 板块）推演",
          updated_at: live.fetched_at,
        },
      ],
      macro_calendar: [
        {
          name: "Nasdaq 经济数据与财报日历",
          covers: "未来 48 小时经济数据与重点财报（美东时间）",
          updated_at: live.fetched_at,
          url: "https://www.nasdaq.com/market-activity/economic-calendar",
        },
      ],
      top_headlines: [
        {
          name: "CNBC / Investing.com / Yahoo Finance（RSS）",
          covers: "宏观、市场与财报头条（英文标题经 AI 翻译成中文）",
          updated_at: live.fetched_at,
          url: "https://www.cnbc.com/world-markets/",
        },
      ],

    },
  };
}

export function useMacroBriefing() {
  return useQuery({
    queryKey: ["macro-briefing"],
    queryFn: fetchMacroBriefing,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => 1500 * (attempt + 1),
  });
}
