import { describe, expect, it, vi } from "vitest";

import {
  runDebateHarness,
  verifyAgainstFacts,
  type DebateCase,
} from "./research-harness.server";

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

  it("falls back when an analyst times out without waiting for the pending task", async () => {
    const fallback = vi.fn(async () => ({ value: 7 }));
    const result = await runDebateHarness({
      bull: () => new Promise<DebateCase>(() => {}),
      bear: async () => debateCase,
      synthesize: async () => ({ value: 42 }),
      fallback,
      verify: () => ({ passed: true, checked_values: 0, violations: [] }),
      synthesizerModel: "deep",
      timeoutMs: 5,
    });
    expect(result.output.value).toBe(7);
    expect(result.trace.architecture).toBe("single-call-fallback");
    expect(result.trace.fallback_reason).toContain("timed out");
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("falls back when synthesis fails", async () => {
    const fallback = vi.fn(async () => ({ value: 7 }));
    const result = await runDebateHarness({
      bull: async () => debateCase,
      bear: async () => debateCase,
      synthesize: async () => {
        throw new Error("invalid structured output");
      },
      fallback,
      verify: () => ({ passed: true, checked_values: 0, violations: [] }),
      synthesizerModel: "deep",
    });

    expect(result.output.value).toBe(7);
    expect(result.trace.architecture).toBe("single-call-fallback");
    expect(result.trace.agents.synthesizer.status).toBe("failed");
    expect(result.trace.fallback_reason).toContain("invalid structured output");
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("retries an ungrounded synthesis with violations", async () => {
    const synthesize = vi
      .fn()
      .mockResolvedValueOnce({ claims: [{ kind: "fact", text: "Growth 99%" }] })
      .mockResolvedValueOnce({
        claims: [{ kind: "fact", text: "Growth 25%" }],
      });
    const fallback = vi.fn();
    const result = await runDebateHarness({
      bull: async () => debateCase,
      bear: async () => debateCase,
      synthesize,
      fallback,
      verify: (output) => verifyAgainstFacts(output, { growth: "25%" }),
      synthesizerModel: "deep",
    });
    expect(result.trace.verifier_result.passed).toBe(true);
    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(synthesize.mock.calls[1]?.[2]?.[0]?.value).toBe("99%");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("rejects ungrounded output even after fallback", async () => {
    await expect(
      runDebateHarness({
        bull: async () => debateCase,
        bear: async () => debateCase,
        synthesize: async () => ({
          claims: [{ kind: "fact", text: "Growth 99%" }],
        }),
        fallback: async () => ({
          claims: [{ kind: "fact", text: "Growth 88%" }],
        }),
        verify: (output) => verifyAgainstFacts(output, { growth: "25%" }),
        synthesizerModel: "deep",
      }),
    ).rejects.toThrow("Research fact verification failed");
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
    expect(result.violations).toEqual([]);

    const bad = verifyAgainstFacts(
      {
        claims: [{ kind: "fact", text: "Revenue grew 99%", source: "filing" }],
      },
      { revenue_growth: "25%" },
    );
    expect(bad.passed).toBe(false);
    expect(bad.violations[0]?.value).toBe("99%");
  });

  it("does not verify numeric claims marked as inference", () => {
    const result = verifyAgainstFacts(
      { claims: [{ kind: "inference", text: "Revenue could grow 99%" }] },
      { revenue_growth: "25%" },
    );

    expect(result).toEqual({ passed: true, checked_values: 0, violations: [] });
  });

  it("does not confuse numeric ticker identifiers with unsupported facts", () => {
    const result = verifyAgainstFacts(
      {
        peer_comparison: [
          { kind: "fact", ticker: "005930.KS", note: "verified peer" },
        ],
      },
      { profile: "AAPL" },
    );
    expect(result).toEqual({ passed: true, checked_values: 0, violations: [] });
  });

  it("does not flag a rounded market cap that the trusted profile overwrites", () => {
    const result = verifyAgainstFacts(
      { company_profile: { kind: "fact", market_cap: "4.94T" } },
      { verifiedProfile: { marketCap: 4936860972280 } },
    );
    expect(result).toEqual({ passed: true, checked_values: 0, violations: [] });
  });
});
