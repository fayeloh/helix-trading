import { createServerFn } from "@tanstack/react-start";

import { getLiveCalendar, getLiveHeadlines } from "./macro-briefing.news.server";
import { getMacroMarketData } from "./macro-briefing.server";

/** 公开只读：每日简报所需的实时行情硬数据。 */
export const getMacroBriefingData = createServerFn({ method: "GET" }).handler(async () => {
  return await getMacroMarketData();
});

/** 公开只读：实时头条与未来一周高重要性宏观日历（真实来源，含发布时间与链接）。 */
export const getMacroBriefingNews = createServerFn({ method: "GET" }).handler(async () => {
  const [headlines, calendar] = await Promise.all([
    getLiveHeadlines(5).catch(() => []),
    getLiveCalendar(12).catch(() => []),
  ]);
  return { headlines, calendar };
});
