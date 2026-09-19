import { describe, expect, it, vi } from "vitest";

import { runDebateHarness, verifyAgainstFacts, type DebateCase } from "./research-harness.server";

const debateCase: DebateCase = {
  thesis: "grounded thesis",
  claims: [],
  caveats: "none",
};

describe("runDebateHarness", () => {
  it("runs bull and bear before synthesis and records verification", async () => {
    const synthesize = vi.fn(async () => ({ value: 42 }));
    const fallback = vi.fn(async () => ({ value: 0 }));
    const result = await runDebateHarness({
      bull: async () => debateCase,
      bear: async () => debateCase,
      synthesize,
      fallback,
      verify: () => ({ passed: true, checked_values: 1, violations: [] }),
      synthesizerModel: "deep",
    });

    expect(result.output.value).toBe(42);
    expect(result.trace.architecture).toBe("multi-agent");
    expect(result.trace.agents.bull.status).toBe("completed");
    expect(result.trace.agents.bear.status).toBe("completed");
    expect(synthesize).toHaveBeenCalledWith(debateCase, debateCase);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("falls back when an analyst fails", async () => {
    const synthesize = vi.fn(async () => ({ value: 42 }));
    const result = await runDebateHarness({
      bull: async () => {
        throw new Error("gateway unavailable");
      },
      bear: async () => debateCase,
      synthesize,
      fallback: async () => ({ value: 7 }),
      verify: () => ({ passed: true, checked_values: 0, violations: [] }),
      synthesizerModel: "deep",
    });

    expect(result.output.value).toBe(7);
    expect(result.trace.architecture).toBe("single-call-fallback");
    expect(result.trace.fallback_reason).toContain("gateway unavailable");
    expect(synthesize).not.toHaveBeenCalled();
  });
});

describe("verifyAgainstFacts", () => {
  it("flags ungrounded numbers in fact claims", () => {
    const result = verifyAgainstFacts(
      {
        claims: [
          { kind: "fact", text: "Revenue grew 25% in 2025", source: "filing" },
          { kind: "inference", text: "Could grow 40%" },
        ],
      },
      { revenue_growth: "25%", fiscal_year: 2025 },
    );
    expect(result.passed).toBe(true);
    expect(result.checked_values).toBe(2);

    const bad = verifyAgainstFacts(
      { claims: [{ kind: "fact", text: "Revenue grew 99%", source: "filing" }] },
      { revenue_growth: "25%" },
    );
    expect(bad.passed).toBe(false);
    expect(bad.violations[0]?.value).toBe("99%");
  });
});
