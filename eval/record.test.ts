import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCompanyProfile } from "../src/lib/fundamentals.server";
import { resolveSymbol } from "../src/lib/symbol-resolver.server";
import type { GoldenFixture } from "./judge";

describe.skipIf(process.env["HELIX_RECORD"] !== "1")(
  "record public-data golden fixtures",
  () => {
    it("freezes two verified profiles and one refusal path", async () => {
      const fixtures: GoldenFixture[] = [];
      for (const symbol of ["AAPL", "CRWV", "ZZZZZZ"]) {
        const resolved = await resolveSymbol(symbol, "US");
        if (symbol === "ZZZZZZ") {
          expect(resolved.verified).toBe(false);
          fixtures.push({
            symbol,
            market: "US",
            captured_at: new Date().toISOString(),
            provenance: "recorded-public-data",
            expected_verified: false,
            known_traps: [],
          });
          continue;
        }
        expect(resolved.verified).toBe(true);
        const actual = await getCompanyProfile(symbol);
        expect(actual).not.toBeNull();
        // Deliberate missing-data trap: both architectures see the same masked input.
        const verifiedProfile = { ...actual!, employees: null };
        const grounding = `\n已验证标的身份（${resolved.source ?? "公开市场数据"}）：${JSON.stringify(resolved)}\n真实公司档案（来源 ${verifiedProfile.source}，${verifiedProfile.as_of}，必须原样采用）：${JSON.stringify(verifiedProfile)}`;
        fixtures.push({
          symbol,
          market: "US",
          captured_at: new Date().toISOString(),
          provenance: "recorded-public-data",
          expected_verified: true,
          snapshot: {
            commonUser: `研究标的：${symbol}（市场 US，标准行情代码 ${symbol}）。资金流向时间窗：过去 90 天。\n实时行情参考：行情数据不可用${grounding}`,
            grounding,
            resolved,
            verifiedProfile,
            lang: "zh",
          },
          known_traps: ["company_profile.employees"],
        });
      }
      const directory = join(process.cwd(), "eval", "fixtures");
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, "golden.json"),
        JSON.stringify(fixtures, null, 2) + "\n",
      );
    }, 120_000);
  },
);
