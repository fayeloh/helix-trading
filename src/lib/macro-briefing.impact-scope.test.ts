import { describe, expect, it } from "vitest";

import { formatImpactScope, resolveImpactScope } from "./macro-briefing.impact-scope";

describe("resolveImpactScope", () => {
  it("市场按固定优先顺序输出（美股先于加密货币）", () => {
    const scope = resolveImpactScope({
      headline: "比特币与纳斯达克同步走强",
      impact: "bullish",
      affected_sectors: ["科技"],
      affected_tickers: [],
    });
    expect(scope.markets).toEqual(["美股", "加密货币"]);
    expect(scope.sectors).toEqual(["科技"]);
  });

  it("按 ticker 归类港股、加密与贵金属", () => {
    expect(
      resolveImpactScope({
        headline: "个股消息",
        impact: "bearish",
        affected_tickers: ["0700.HK", "ETH-USD", "GC=F", "AAPL"],
      }).markets,
    ).toEqual(["美股", "港股与A股", "加密货币", "贵金属"]);
  });

  it("无法归类时不猜测", () => {
    const scope = resolveImpactScope({ headline: "某地天气转凉", impact: "bullish" });
    expect(scope.markets).toEqual([]);
    expect(formatImpactScope(scope)).toBe("利多，但具体影响范围未确认");
  });

  it("中性新闻使用保守文案", () => {
    const text = formatImpactScope(
      resolveImpactScope({ headline: "恒生指数窄幅震荡", impact: "neutral" }),
    );
    expect(text).toBe("方向暂不明确，需关注：港股与A股");
  });

  it("同一条新闻可同时标出利多与利空板块", () => {
    const scope = resolveImpactScope({
      headline: "OPEC+ 意外减产，油价大涨",
      impact: "bullish",
      affected_sectors: ["能源"],
    });
    expect(scope.bullish).toEqual(["能源"]);
    expect(scope.bearish).toEqual(["航空与运输", "消费"]);
    expect(formatImpactScope(scope)).toBe("利多：能源｜利空：航空与运输、消费");
  });

  it("未命中对立关系时保持单一方向", () => {
    const scope = resolveImpactScope({
      headline: "某公司宣布回购",
      impact: "bullish",
      affected_sectors: ["科技"],
    });
    expect(scope.bullish).toEqual([]);
    expect(scope.bearish).toEqual([]);
  });

  it("利空文案先市场后板块", () => {
    const text = formatImpactScope(
      resolveImpactScope({
        headline: "美债收益率大涨，标普承压",
        impact: "bearish",
        affected_sectors: ["科技", "房地产"],
      }),
    );
    expect(text).toBe("利空：美股、债券｜板块：科技、房地产");
  });
});
