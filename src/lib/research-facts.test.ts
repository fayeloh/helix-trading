import { describe, expect, it } from "vitest";

import { computeReaction } from "./earnings-reaction.server";
import { computeSeasonality } from "./seasonality.server";

function candle(date: string, c: number) {
  return { t: new Date(`${date}T00:00:00Z`).getTime(), c, o: c, h: c, l: c };
}

describe("computeReaction", () => {
  const candles = [
    candle("2026-01-05", 100),
    candle("2026-01-06", 110),
    candle("2026-01-07", 121),
    candle("2026-01-08", 121),
    candle("2026-01-09", 132),
    candle("2026-01-12", 99),
  ];

  it("盘后财报以报告日收盘为基准", () => {
    const r = computeReaction(candles, "2026-01-05", "after_close");
    expect(r?.base_date).toBe("2026-01-05");
    expect(r?.base_close).toBe(100);
    expect(r?.d1_pct).toBe(10);
    expect(r?.d3_pct).toBe(21);
    expect(r?.d5_pct).toBe(-1);
  });

  it("盘前财报以前一交易日收盘为基准", () => {
    const r = computeReaction(candles, "2026-01-06", "before_open");
    expect(r?.base_date).toBe("2026-01-05");
    expect(r?.d1_pct).toBe(10);
  });

  it("缺少行情时各字段为 null，不推测数字", () => {
    const r = computeReaction([], "2026-01-06", "after_close");
    expect(r?.base_date).toBeNull();
    expect(r?.d1_pct).toBeNull();
    expect(r?.d5_pct).toBeNull();
  });
});

describe("computeSeasonality", () => {
  it("统计月均涨幅、胜率与年度高低点月份", () => {
    const monthly = [] as ReturnType<typeof candle>[];
    let price = 100;
    for (let y = 2022; y <= 2025; y += 1) {
      for (let m = 1; m <= 12; m += 1) {
        // 1 月固定上涨，7 月固定下跌
        price = m === 1 ? price * 1.1 : m === 7 ? price * 0.9 : price * 1.01;
        monthly.push(candle(`${y}-${String(m).padStart(2, "0")}-01`, Number(price.toFixed(4))));
      }
    }
    const s = computeSeasonality("TEST", monthly);
    expect(s).not.toBeNull();
    const jan = s!.months.find((m) => m.month === 1)!;
    const jul = s!.months.find((m) => m.month === 7)!;
    expect(jan.avg_return_pct!).toBeGreaterThan(0);
    expect(jan.win_rate_pct).toBe(100);
    expect(jul.avg_return_pct!).toBeLessThan(0);
    expect(jul.win_rate_pct).toBe(0);
    expect(s!.months).toHaveLength(12);
    expect(s!.complete_years).toBeGreaterThanOrEqual(3);
  });

  it("样本不足时不产出统计数字", () => {
    const s = computeSeasonality("TEST", [candle("2026-01-01", 10)]);
    expect(s.complete_years).toBe(0);
    expect(s.top_year_high_month).toBeNull();
    expect(s.months.every((m) => m.avg_return_pct === null)).toBe(true);
  });
});
