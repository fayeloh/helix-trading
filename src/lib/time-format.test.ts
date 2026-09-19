import { describe, expect, it } from "vitest";

import {
  ET_ZONE,
  formatFullInZone,
  formatInZone,
  offsetLabel,
  parseEt,
  zoneShortLabel,
} from "./time-format";

describe("parseEt", () => {
  it("夏令时期间按 UTC-4 解析", () => {
    const d = parseEt("2026-08-26 20:00");
    expect(d?.toISOString()).toBe("2026-08-27T00:00:00.000Z");
  });

  it("冬令时期间按 UTC-5 解析", () => {
    const d = parseEt("2026-01-15 09:30");
    expect(d?.toISOString()).toBe("2026-01-15T14:30:00.000Z");
  });

  it("非法输入返回 null", () => {
    expect(parseEt("待公布")).toBeNull();
    expect(parseEt("")).toBeNull();
  });
});

describe("formatInZone", () => {
  it("美东 20:00 → 上海次日 08:00", () => {
    expect(formatInZone("2026-08-26 20:00", "Asia/Shanghai")).toBe("08-27 08:00");
  });

  it("换算到 UTC", () => {
    expect(formatInZone("2026-08-26 20:00", "UTC")).toBe("08-27 00:00");
  });

  it("同为美东时保持原值", () => {
    expect(formatInZone("2026-08-27 08:30", ET_ZONE)).toBe("08-27 08:30");
  });

  it("午夜显示 00:00 而非 24:00", () => {
    expect(formatInZone("2026-08-26 20:00", "UTC").endsWith("00:00")).toBe(true);
  });

  it("无法解析时原样返回", () => {
    expect(formatInZone("待公布", "Asia/Shanghai")).toBe("待公布");
  });
});

describe("formatFullInZone", () => {
  it("输出完整日期", () => {
    expect(formatFullInZone("2026-08-26 22:05", "Asia/Shanghai")).toBe("2026-08-27 10:05");
  });
});

describe("offsetLabel / zoneShortLabel", () => {
  it("上海为 UTC+8", () => {
    expect(offsetLabel("Asia/Shanghai", new Date("2026-08-26T00:00:00Z"))).toBe("UTC+8");
  });

  it("UTC 无符号", () => {
    expect(offsetLabel("UTC", new Date("2026-08-26T00:00:00Z"))).toBe("UTC");
  });

  it("美东夏令时为 UTC-4", () => {
    expect(offsetLabel(ET_ZONE, new Date("2026-08-26T00:00:00Z"))).toBe("UTC-4");
  });

  it("含半小时偏移", () => {
    expect(offsetLabel("Asia/Kolkata", new Date("2026-08-26T00:00:00Z"))).toBe("UTC+5:30");
  });

  it("短标签包含地名与偏移", () => {
    expect(zoneShortLabel("Asia/Shanghai", new Date("2026-08-26T00:00:00Z"))).toBe(
      "北京 / 上海 UTC+8",
    );
  });
});
