import type { MacroBriefing } from "./macro-briefing.types";

/** 第一阶段使用的 mock 数据；接真实数据源时只需替换 useMacroBriefing 的获取逻辑。 */
export const MACRO_BRIEFING_MOCK: MacroBriefing = {
  date: "2026-08-26",
  global_market_overview: {
    indices: [
      { name: "S&P 500", change_pct: 0.4 },
      { name: "Nasdaq", change_pct: 0.7 },
      { name: "恒生指数", change_pct: -0.3 },
      { name: "日经225", change_pct: 0.9 },
    ],
    vix: 14.2,
    vix_change_pct: -2.1,
    fx: [
      { pair: "USD/CNY", value: 7.12, change_pct: 0.1 },
      { pair: "DXY", value: 103.4, change_pct: -0.2 },
    ],
    commodities: [
      { name: "WTI原油", value: 78.2, change_pct: 1.3 },
      { name: "黄金", value: 2410, change_pct: 0.5 },
    ],
    bond_yields: [{ name: "美10年期国债", value: 4.15, change_bp: -3 }],
  },
  sector_rotation: {
    leading: [{ sector: "半导体", change_pct: 2.1, reason: "AI资本开支预期上修" }],
    lagging: [{ sector: "公用事业", change_pct: -1.2, reason: "利率预期升温压制防御板块" }],
  },
  ai_trend_signals: [
    {
      theme: "美股风险偏好",
      signal: "回升",
      confidence: 0.72,
      trigger: "VIX连续3日下行 + 高收益债利差收窄",
    },
    {
      theme: "美元走势",
      signal: "转弱",
      confidence: 0.6,
      trigger: "非农数据不及预期后市场重新定价降息路径",
    },
  ],
  macro_calendar: [
    {
      event: "美国CPI数据",
      time: "2026-08-27 08:30",
      importance: "high",
      url: "https://www.bls.gov/cpi/",
    },
    {
      event: "英伟达财报",
      time: "2026-08-27 16:00",
      importance: "high",
      url: "https://investor.nvidia.com/events-and-presentations/",
    },
    {
      event: "欧央行官员讲话",
      time: "2026-08-27 20:00",
      importance: "medium",
      url: "https://www.ecb.europa.eu/press/calendars/weekly/html/index.en.html",
    },
  ],
  top_headlines: [
    {
      headline: "美联储官员释放鸽派信号，暗示9月可能降息",
      source: "Reuters",
      time: "2026-08-26 21:30",
      impact: "bullish",
      affected_sectors: ["科技", "房地产", "小盘股"],
      affected_tickers: ["QQQ", "IWM"],
      reasoning: "降息预期升温利好利率敏感型板块及高估值成长股",
      url: "https://www.reuters.com/markets/us/",
    },
    {
      headline: "中东局势升级，地缘风险推升原油价格",
      source: "Bloomberg",
      time: "2026-08-26 18:05",
      impact: "bearish",
      affected_sectors: ["航空", "运输"],
      affected_tickers: ["XLE", "DAL"],
      reasoning: "油价上行推高运营成本，压制航空运输板块利润预期",
      url: "https://www.bloomberg.com/energy",
    },
    {
      headline: "英伟达上调AI资本开支指引",
      source: "CNBC",
      time: "2026-08-26 16:45",
      impact: "bullish",
      affected_sectors: ["半导体", "云计算"],
      affected_tickers: ["NVDA", "AVGO", "SMCI"],
      reasoning: "资本开支上修强化AI基建需求持续性预期",
      url: "https://www.cnbc.com/technology/",
    },
    {
      headline: "美国7月耐用品订单环比持平，符合预期",
      source: "Reuters",
      time: "2026-08-26 08:30",
      impact: "neutral",
      affected_sectors: ["工业"],
      affected_tickers: [],
      reasoning: "数据符合预期，未改变现有利率路径定价",
      url: "https://www.census.gov/manufacturing/m3/",
    },
  ],
  fetched_at: "2026-08-26 22:05",
  sources: {
    summary: [
      { name: "Helix 汇总引擎", covers: "基于以下各模块数据自动生成", updated_at: "2026-08-26 22:05" },
    ],
    global_market_overview: [
      { name: "Yahoo Finance", covers: "股指 / VIX（恐慌指数）", updated_at: "2026-08-26 21:50", url: "https://finance.yahoo.com/markets/" },
      { name: "Financial Modeling Prep", covers: "汇率 / 大宗商品", updated_at: "2026-08-26 21:45", url: "https://site.financialmodelingprep.com/" },
      { name: "U.S. Treasury", covers: "美债收益率", updated_at: "2026-08-26 20:00", url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates" },
    ],
    sector_rotation: [
      { name: "Yahoo Finance 行业板块", covers: "板块涨跌幅", updated_at: "2026-08-26 21:50", url: "https://finance.yahoo.com/sectors/" },
    ],
    ai_trend_signals: [
      { name: "Helix AI 模型", covers: "趋势方向 / 置信度 / 触发依据", updated_at: "2026-08-26 22:00" },
    ],
    macro_calendar: [
      { name: "美国劳工统计局", covers: "通胀等官方数据发布时间", updated_at: "2026-08-26 18:00", url: "https://www.bls.gov/schedule/news_release/" },
      { name: "公司投资者关系页", covers: "财报发布时间", updated_at: "2026-08-26 17:30", url: "https://investor.nvidia.com/events-and-presentations/" },
    ],
    top_headlines: [
      { name: "Google News RSS", covers: "财经头条聚合", updated_at: "2026-08-26 22:02", url: "https://news.google.com/" },
      { name: "Yahoo Finance News", covers: "个股与板块相关新闻", updated_at: "2026-08-26 21:55", url: "https://finance.yahoo.com/news/" },
    ],
  },
};
