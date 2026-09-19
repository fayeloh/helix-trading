import { describe, expect, it } from "vitest";

import { annotate, collectTerms } from "./macro-briefing.glossary";
import {
  KEYWORD_MAX_COUNT,
  filterMarketGroups,
  filterSectors,
  marketKeyOf,
  matchesKeywords,
  normalizeKeyword,
  normalizeKeywords,
} from "./macro-briefing.markets";
import {
  buildExecutiveSummary,
  buildFocusLead,
  buildHeadlineNotes,
  composeMarketLead,
  groupMarkets,
} from "./macro-briefing.summarize";
import type { MacroBriefing, TopHeadline } from "./macro-briefing.types";

const NOW = new Date("2026-08-26T22:00:00Z");

const overview = {
  indices: [
    { name: "S&P 500", change_pct: 0.4 },
    { name: "Nasdaq", change_pct: 0.8 },
    { name: "恒生指数", change_pct: -0.6 },
  ],
  vix: 14.2,
  vix_change_pct: -2.1,
  fx: [{ pair: "DXY", value: 103.4, change_pct: -0.2 }],
  commodities: [
    { name: "黄金", value: 2410, change_pct: 0.9 },
    { name: "WTI原油", value: 78.2, change_pct: 1.3 },
  ],
  bond_yields: [{ name: "美10年期国债", value: 4.15, change_bp: -3 }],
};

const headlines: TopHeadline[] = [
  {
    headline: "美联储官员暗示9月降息",
    source: "Reuters",
    time: "2026-08-26 21:30",
    impact: "bullish",
    affected_sectors: ["科技", "房地产"],
    affected_tickers: ["QQQ"],
    reasoning: "降息预期升温利好高估值成长股",
    url: "https://example.com/a",
  },
  {
    headline: "耐用品订单持平",
    source: "Reuters",
    time: "2026-08-26 08:30",
    impact: "neutral",
    affected_sectors: ["工业"],
    affected_tickers: [],
    reasoning: "数据符合预期",
  },
];

function briefing(over: Partial<MacroBriefing> = {}): MacroBriefing {
  return {
    date: "2026-08-26",
    global_market_overview: overview,
    sector_rotation: {
      leading: [{ sector: "半导体", change_pct: 2.1, reason: "AI资本开支上修" }],
      lagging: [{ sector: "公用事业", change_pct: -1.2, reason: "利率预期升温" }],
    },
    macro_calendar: [{ event: "美国CPI数据", time: "2026-08-27 08:30", importance: "high" }],
    top_headlines: headlines,
    ...over,
  };
}

describe("marketKeyOf", () => {
  it("按名称归类到市场分组", () => {
    expect(marketKeyOf("Nasdaq")).toBe("us_equity");
    expect(marketKeyOf("恒生科技")).toBe("hk_cn_equity");
    expect(marketKeyOf("黄金")).toBe("precious_metals");
    expect(marketKeyOf("WTI原油")).toBe("energy");
    expect(marketKeyOf("美10年期国债")).toBe("bonds");
    expect(marketKeyOf("某个不认识的标的")).toBeUndefined();
  });
});

describe("groupMarkets / composeMarketLead", () => {
  it("分别给出各市场的回暖或走弱判断", () => {
    const groups = groupMarkets(overview);
    const us = groups.find((g) => g.key === "us_equity")!;
    const hk = groups.find((g) => g.key === "hk_cn_equity")!;
    expect(us.verdict).toBe("回暖");
    expect(hk.verdict).toBe("走弱");
    expect(groups.find((g) => g.key === "precious_metals")!.verdict).toBe("回暖");
  });

  it("开头明确点名具体市场", () => {
    const lead = composeMarketLead(overview);
    expect(lead).toContain("美股回暖");
    expect(lead).toContain("港股与A股走弱");
    expect(lead).toContain("贵金属");
  });

  it("无数据时返回空串", () => {
    expect(composeMarketLead(undefined)).toBe("");
    expect(groupMarkets(undefined)).toEqual([]);
  });
});

describe("buildFocusLead", () => {
  it("没有偏好时不输出关注归纳", () => {
    expect(buildFocusLead(briefing(), { markets: [], sectors: [], keywords: [] })).toBe("");
    expect(buildFocusLead(briefing())).toBe("");
  });

  it("按偏好归纳关注的市场与板块", () => {
    const lead = buildFocusLead(briefing(), {
      markets: ["us_equity", "precious_metals"],
      sectors: ["半导体"],
      keywords: [],
    });
    expect(lead.startsWith("你关注的部分：")).toBe(true);
    expect(lead).toContain("美股");
    expect(lead).toContain("贵金属");
    expect(lead).toContain("半导体");
  });

  it("关注项当天没有数据时给出提示", () => {
    const lead = buildFocusLead({ date: "2026-08-26" }, { markets: ["crypto"], sectors: [], keywords: [] });
    expect(lead).toContain("没有可用数据");
  });
});

describe("buildHeadlineNotes", () => {
  it("每条新闻带解读与利多/利空/中性", () => {
    const notes = buildHeadlineNotes(headlines);
    expect(notes).toHaveLength(2);
    expect(notes[0]!.impact).toBe("bullish");
    expect(notes[0]!.note).toContain("降息预期");
    expect(notes[0]!.note).toContain("主要影响");
    expect(notes[0]!.url).toBe("https://example.com/a");
  });

  it("命中关注板块的新闻排前面并标记", () => {
    const notes = buildHeadlineNotes(headlines, 5, { markets: [], sectors: ["工业"], keywords: [] });
    expect(notes[0]!.headline).toBe("耐用品订单持平");
    expect(notes[0]!.focused).toBe(true);
  });

  it("无新闻返回空数组", () => {
    expect(buildHeadlineNotes([])).toEqual([]);
    expect(buildHeadlineNotes(undefined)).toEqual([]);
  });
});

describe("annotate / collectTerms", () => {
  it("术语首次出现处加括号简注，且不重复", () => {
    const out = annotate("VIX 回落，后面再提 VIX 不再解释。");
    expect(out).toContain("VIX（恐慌指数");
    expect(out.match(/恐慌指数/g)).toHaveLength(1);
  });

  it("已有括号说明时不重复加注", () => {
    const out = annotate("CPI（消费者物价指数）今晚公布");
    expect(out.match(/消费者物价指数/g)).toHaveLength(1);
  });

  it("术语表按出现顺序收集", () => {
    const terms = collectTerms("VIX 与 CPI 都值得看，bp 是基点。");
    expect(terms.map((t) => t.term)).toEqual(["VIX", "CPI", "bp"]);
  });
});

describe("buildExecutiveSummary", () => {
  it("段落以关注归纳与分市场判断开头，并输出新闻与术语表", () => {
    const r = buildExecutiveSummary(briefing(), NOW, {
      markets: ["us_equity"],
      sectors: ["半导体"],
      keywords: [],
    });
    expect(r.paragraph.startsWith("你关注的部分：")).toBe(true);
    expect(r.paragraph).toContain("分市场看：");
    expect(r.paragraph).not.toContain("不构成任何投资建议");
    expect(r.headlines.length).toBe(2);
    expect(r.terms.length).toBeGreaterThan(0);
    expect(r.disclaimer).toContain("不构成任何投资建议");
  });

  it("没有偏好时不出现关注归纳", () => {
    const r = buildExecutiveSummary(briefing(), NOW);
    expect(r.paragraph.startsWith("分市场看：")).toBe(true);
  });

  it("数据缺失时仍可安全生成", () => {
    const r = buildExecutiveSummary({ date: "2026-08-26" }, NOW);
    expect(typeof r.paragraph).toBe("string");
    expect(r.headlines).toEqual([]);
  });
});

describe("自定义关注关键词", () => {
  it("清洗关键词：去空白、压缩空格、限制长度", () => {
    expect(normalizeKeyword("  英伟达  ")).toBe("英伟达");
    expect(normalizeKeyword("新能源   汽车")).toBe("新能源 汽车");
    expect(normalizeKeyword("   ")).toBe("");
    expect(normalizeKeyword("啊".repeat(40)).length).toBe(24);
  });

  it("数组清洗：去重（大小写不敏感）、丢弃非法项、限制数量", () => {
    expect(normalizeKeywords(["TSLA", "tsla", " ", 5, "NVDA"])).toEqual(["TSLA", "NVDA"]);
    expect(normalizeKeywords(undefined)).toEqual([]);
    expect(normalizeKeywords(Array.from({ length: 40 }, (_, i) => `k${i}`)).length).toBe(
      KEYWORD_MAX_COUNT,
    );
  });

  it("关键词包含匹配且大小写不敏感", () => {
    expect(matchesKeywords("英伟达上调AI资本开支指引", ["英伟达"])).toBe(true);
    expect(matchesKeywords("NVDA", ["nvda"])).toBe(true);
    expect(matchesKeywords("半导体", ["半导体行业"])).toBe(true);
    expect(matchesKeywords("恒生指数", ["黄金"])).toBe(false);
    expect(matchesKeywords("任意文本", [])).toBe(false);
  });

  it("搜索过滤市场与板块", () => {
    expect(filterMarketGroups("黄金").map((g) => g.key)).toEqual(["precious_metals"]);
    expect(filterMarketGroups("nasdaq").map((g) => g.key)).toEqual(["us_equity"]);
    expect(filterMarketGroups("").length).toBeGreaterThan(1);
    expect(filterSectors("半导")).toEqual(["半导体"]);
    expect(filterSectors("不存在的板块")).toEqual([]);
  });

  it("关键词命中行情条目时进入开头归纳", () => {
    const lead = buildFocusLead(briefing(), { markets: [], sectors: [], keywords: ["恒生"] });
    expect(lead).toContain("恒生指数");
  });

  it("关键词命中新闻标题或标的时进入开头归纳", () => {
    const lead = buildFocusLead(briefing(), { markets: [], sectors: [], keywords: ["QQQ"] });
    expect(lead).toContain("相关新闻");
  });

  it("关键词命中的新闻被标记 focused 并排前面", () => {
    const notes = buildHeadlineNotes(headlines, 5, {
      markets: [],
      sectors: [],
      keywords: ["耐用品"],
    });
    expect(notes[0]?.focused).toBe(true);
    expect(notes[0]?.headline).toContain("耐用品");
  });

  it("关键词全部无数据时给出提示", () => {
    const lead = buildFocusLead(
      { date: "2026-08-26" },
      { markets: [], sectors: [], keywords: ["比特币"] },
    );
    expect(lead).toContain("没有可用数据");
  });
});
