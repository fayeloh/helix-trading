import { describe, expect, it } from "vitest";
import { scoreReport, type GoldenFixture } from "./judge";

const fixture: GoldenFixture = {
  symbol: "EXAMPLE",
  market: "US",
  captured_at: "2026-09-20",
  provenance: "recorded-public-data",
  expected_verified: true,
  snapshot: {
    commonUser: "",
    grounding: "",
    lang: "zh",
    resolved: {
      symbol: "EXAMPLE",
      name: "Example",
      exchange: null,
      market: "US",
      type: "股票",
      verified: true,
      source: "test",
    },
    verifiedProfile: { employees: null, marketCap: 25 },
  },
  known_traps: ["company_profile.employees"],
};

describe("offline golden judge", () => {
  it("catches a fabricated null and an unsupported fact number", () => {
    const result = scoreReport(
      {
        company_profile: { employees: 100 },
        moat: [{ kind: "fact", text: "Revenue increased 99%" }],
      },
      fixture,
    );
    expect(result.fabricated_traps).toEqual(["company_profile.employees"]);
    expect(result.unsupported_numeric_date_claims).toBe(1);
    expect(result.numeric_groundedness).toBe(0);
  });
  it("does not score inference as fact or invent a denominator", () => {
    const result = scoreReport(
      {
        company_profile: { employees: null },
        moat: [{ kind: "inference", text: "Could increase 99%" }],
      },
      fixture,
    );
    expect(result.numeric_groundedness).toBeNull();
    expect(result.fabricated_traps).toEqual([]);
  });
});
