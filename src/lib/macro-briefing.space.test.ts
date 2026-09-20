import { describe, expect, it } from "vitest";

import { expandBullishSpaceImpact } from "./macro-briefing.space";
import type { TopHeadline } from "./macro-briefing.types";

const headline = (overrides: Partial<TopHeadline> = {}): TopHeadline => ({
  headline: "商业航天订单大幅增长",
  source: "Test",
  time: "2026-09-19 09:00",
  impact: "bullish",
  affected_sectors: [],
  affected_tickers: ["RKLB"],
  reasoning: "原始分析",
  ...overrides,
});

describe("expandBullishSpaceImpact", () => {
  it("把利多航天新闻细化为利多整个太空板块", () => {
    const result = expandBullishSpaceImpact(headline());

    expect(result.affected_sectors[0]).toBe("太空板块");
    expect(result.reasoning).toContain("利多整个太空板块");
  });

  it("不改写方向不明确的太空新闻", () => {
    const input = headline({ impact: "neutral" });

    expect(expandBullishSpaceImpact(input)).toBe(input);
  });

  it("可识别只写太空公司名称的英文头条", () => {
    const result = expandBullishSpaceImpact(
      headline({
        headline: "AST SpaceMobile wins major contract",
        affected_sectors: [],
      }),
    );

    expect(result.affected_sectors).toContain("太空板块");
  });
});
