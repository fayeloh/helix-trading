import { describe, expect, it } from "vitest";

import {
  assembleParagraph,
  buildBriefSummary,
  buildExecutiveParagraph,
  composeMarketRegime,
  scoreMateriality,
  selectTopHeadline,
  HARD_MAX,
} from "./macro-briefing.summarize";
import type { MacroBriefing, TopHeadline } from "./macro-briefing.types";

const NOW = new Date("2026-08-26T22:00:00Z");

function briefing(over: Partial<MacroBriefing> = {}): MacroBriefing {
  return {
    date: "2026-08-26",
    global_market_overview: {
      indices: [
        { name: "S&P 500", change_pct: 0.4 },
        { name: "Nasdaq", change_pct: 0.7 },
        { name: "恒生指数", change_pct: -0.3 },
      ],
      vix: 14.2,
      vix_change_pct: -2.1,
      fx: [{ pair: "DXY", value: 103.4, change_pct: -0.2 }],
      commodities: [{ name: "黄金", value: 2410, change_pct: 0.5 }],
      bond_yields: [{ name: "美10年期国债", value: 4.15, change_bp: -3 }],
    },
    sector_rotation: {
      leading: [{ sector: "半导体", change_pct: 2.1, reason: "AI资本开支上修" }],
      lagging: [{ sector: "公用事业", change_pct: -1.2, reason: "利率预期升温" }],
    },
    macro_calendar: [
      { event: "美国CPI数据", time: "2026-08-27 08:30", importance: "high" },
      { event: "欧央行讲话", time: "2026-08-27 20:00", importance: "medium" },
    ],
    top_headlines: [
      {
        headline: "美联储官员释放鸽派信号",
        source: "Reuters",
        time: "2026-08-26 21:30",
        impact: "bullish",
        affected_sectors: ["科技", "房地产"],
        affected_tickers: ["QQQ", "IWM"],
        reasoning: "降息预期升温",
      },
    ],
    ...over,
  };
}

describe("scoreMateriality", () => {
  it("主流指数权重高于区域指数", () => {
    expect(scoreMateriality({ kind: "index", name: "S&P 500", change_pct: 1 })).toBeGreaterThan(
      scoreMateriality({ kind: "index", name: "恒生指数", change_pct: 1 }),
    );
  });

  it("VIX 变动放大 1.5 倍", () => {
    expect(scoreMateriality({ kind: "vix", change_pct: -2 })).toBeCloseTo(3);
  });

  it("超过 48 小时的日历事件不计分", () => {
    expect(scoreMateriality({ kind: "calendar", importance: "high", hoursAhead: 72 })).toBe(0);
    expect(scoreMateriality({ kind: "calendar", importance: "high", hoursAhead: 12 })).toBe(3);
  });

  it("头条广度提升分数", () => {
    const narrow = scoreMateriality({ kind: "headline", importance: "high", breadth: 0 });
    const wide = scoreMateriality({ kind: "headline", importance: "high", breadth: 4 });
    expect(wide).toBeGreaterThan(narrow);
  });
});

describe("composeMarketRegime", () => {
  it("平淡的一天判为中性", () => {
    const r = composeMarketRegime({
      indices: [
        { name: "S&P 500", change_pct: 0.05 },
        { name: "Nasdaq", change_pct: -0.05 },
      ],
      vix: 14,
      vix_change_pct: 0.1,
      fx: [],
      commodities: [],
      bond_yields: [],
    });
    expect(r.label).toBe("中性");
  });

  it("暴涨日判为明显偏暖", () => {
    const r = composeMarketRegime({
      indices: [
        { name: "S&P 500", change_pct: 2.5 },
        { name: "Nasdaq", change_pct: 3.1 },
      ],
      vix: 12,
      vix_change_pct: -8,
      fx: [],
      commodities: [],
      bond_yields: [],
    });
    expect(r.label).toBe("明显偏暖");
  });

  it("暴跌日判为明显谨慎", () => {
    const r = composeMarketRegime({
      indices: [
        { name: "S&P 500", change_pct: -2.8 },
        { name: "Nasdaq", change_pct: -3.4 },
      ],
      vix: 28,
      vix_change_pct: 22,
      fx: [],
      commodities: [],
      bond_yields: [],
    });
    expect(r.label).toBe("明显谨慎");
  });

  it("指数上涨但 VIX 同步走高时输出复合判断句", () => {
    const r = composeMarketRegime({
      indices: [{ name: "S&P 500", change_pct: 0.6 }],
      vix: 18,
      vix_change_pct: 4,
      fx: [],
      commodities: [],
      bond_yields: [],
    });
    expect(r.label).toBe("信号分歧");
    expect(r.detail).toContain("VIX 同步走高");
  });

  it("完全无数据时降级", () => {
    expect(composeMarketRegime(undefined).label).toBe("数据不足");
  });
});

describe("selectTopHeadline", () => {
  it("空数组返回 undefined", () => {
    expect(selectTopHeadline([])).toBeUndefined();
    expect(selectTopHeadline(undefined)).toBeUndefined();
  });

  it("挑出影响面最广的一条", () => {
    const list: TopHeadline[] = [
      {
        headline: "窄面新闻",
        source: "A",
        time: "2026-08-26 10:00",
        impact: "bullish",
        affected_sectors: [],
        affected_tickers: [],
        reasoning: "-",
      },
      {
        headline: "宽面新闻",
        source: "B",
        time: "2026-08-26 11:00",
        impact: "bearish",
        affected_sectors: ["科技", "能源"],
        affected_tickers: ["QQQ", "XLE", "SPY"],
        reasoning: "-",
      },
    ];
    expect(selectTopHeadline(list)!.headline).toBe("宽面新闻");
  });
});

describe("assembleParagraph", () => {
  it("超过硬上限时先丢弃分数最低的整句", () => {
    const long = (n: number) => "字".repeat(200) + `${n}。`;
    const text = assembleParagraph(
      [
        { text: long(1), score: 0.1, category: "fx" },
        { text: long(2), score: 9, category: "index" },
        { text: long(3), score: 5, category: "vix" },
        { text: long(4), score: 0.2, category: "commodity" },
      ],
      { label: "中性", detail: "多空均衡。", score: 0 },
      undefined,
    );
    expect(text.length).toBeLessThanOrEqual(HARD_MAX);
    expect(text).toContain("2。");
    expect(text).not.toContain("1。");
  });

  it("没有候选内容时仍返回免责声明", () => {
    const text = assembleParagraph([], { label: "数据不足", detail: "暂无数据。", score: 0 }, undefined);
    expect(text).toContain("不构成任何投资建议");
  });
});

describe("buildExecutiveParagraph", () => {
  it("不超过 900 字硬上限且以句号结尾", () => {
    const text = buildExecutiveParagraph(briefing(), NOW);
    expect(text.length).toBeLessThanOrEqual(HARD_MAX);
    expect(text.endsWith("。")).toBe(true);
  });

  it("平淡的一天输出更短，不凑字数", () => {
    const flat = briefing({
      global_market_overview: {
        indices: [{ name: "S&P 500", change_pct: 0.02 }],
        vix: 14,
        vix_change_pct: 0.1,
        fx: [],
        commodities: [],
        bond_yields: [],
      },
      sector_rotation: { leading: [], lagging: [] },
      macro_calendar: [],
      top_headlines: [],
    });
    const text = buildExecutiveParagraph(flat, NOW);
    expect(text.length).toBeLessThan(400);
  });

  it("头条为空时不出现头条提及句", () => {
    const text = buildExecutiveParagraph(briefing({ top_headlines: [] }), NOW);
    expect(text).not.toContain("值得关注的新闻");
  });

  it("头条不在段落里展开，交给新闻清单模块", () => {
    const text = buildExecutiveParagraph(briefing(), NOW);
    expect(text).not.toContain("QQQ");
    expect(text).not.toContain("利多");
  });

  it("宏观日历为空数组时降级不报错", () => {
    const text = buildExecutiveParagraph(briefing({ macro_calendar: [] }), NOW);
    expect(text).not.toContain("未来 48 小时");
  });

  it("全部事件超过 48 小时时不输出日历句", () => {
    const text = buildExecutiveParagraph(
      briefing({
        macro_calendar: [{ event: "远期会议", time: "2026-09-10 08:30", importance: "high" }],
      }),
      NOW,
    );
    expect(text).not.toContain("远期会议");
  });

  it("不再输出术语白话解释", () => {
    const text = buildExecutiveParagraph(briefing(), NOW);
    expect(text).not.toContain("恐慌指数");
    expect(text).not.toContain("基点");
  });

  it("信号冲突日输出复合判断句", () => {
    const text = buildExecutiveParagraph(
      briefing({
        global_market_overview: {
          indices: [{ name: "S&P 500", change_pct: 0.8 }],
          vix: 19,
          vix_change_pct: 5,
          fx: [],
          commodities: [],
          bond_yields: [],
        },
      }),
      NOW,
    );
    expect(text).toContain("VIX 同步走高");
  });
});

describe("buildBriefSummary", () => {
  it("不超过 120 字且 3-4 条要点", () => {
    const bullets = buildBriefSummary(briefing(), NOW);
    expect(bullets.length).toBeGreaterThanOrEqual(2);
    expect(bullets.length).toBeLessThanOrEqual(4);
    expect(bullets.join("").length).toBeLessThanOrEqual(120);
  });

  it("数据缺失时降级为单条", () => {
    const bullets = buildBriefSummary({ date: "2026-08-26" }, NOW);
    expect(bullets.length).toBe(1);
  });
});
