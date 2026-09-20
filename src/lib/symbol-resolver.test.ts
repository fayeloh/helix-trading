import { describe, expect, it } from "vitest";

import { normalizeSymbol } from "./symbol-resolver.server";

describe("normalizeSymbol", () => {
  it("保留完整的美股代码", () => {
    expect(normalizeSymbol(" crwv ", "US")).toBe("CRWV");
  });

  it("将港股数字代码补齐为 Yahoo 格式", () => {
    expect(normalizeSymbol("700", "HK")).toBe("0700.HK");
    expect(normalizeSymbol("0700", "HK")).toBe("0700.HK");
  });

  it("区分上交所与深交所代码", () => {
    expect(normalizeSymbol("600519", "CN")).toBe("600519.SS");
    expect(normalizeSymbol("000001", "CN")).toBe("000001.SZ");
  });

  it("保留用户已输入的市场后缀", () => {
    expect(normalizeSymbol("9988.hk", "HK")).toBe("9988.HK");
    expect(normalizeSymbol("btc-usd", "CRYPTO")).toBe("BTC-USD");
  });
});
