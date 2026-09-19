import { verifyAgainstFacts } from "../src/lib/research-harness.server";

export interface GoldenFixture {
  symbol: string;
  market: "US";
  captured_at: string;
  provenance: "recorded-public-data";
  expected_verified: boolean;
  snapshot?: {
    commonUser: string;
    grounding: string;
    resolved: {
      symbol: string;
      name: string | null;
      exchange: string | null;
      market: "US";
      type: string;
      verified: boolean;
      source: string | null;
    };
    verifiedProfile: Record<string, unknown> | null;
    lang: "zh";
  };
  known_traps: string[];
}

export function scoreReport(output: unknown, fixture: GoldenFixture) {
  if (!fixture.snapshot)
    throw new Error(`No frozen snapshot for ${fixture.symbol}`);
  const { resolved, verifiedProfile, grounding } = fixture.snapshot;
  const verification = verifyAgainstFacts(output, {
    resolved,
    verifiedProfile,
    grounding,
  });
  const record =
    output && typeof output === "object"
      ? (output as Record<string, unknown>)
      : {};
  const failedTraps = fixture.known_traps.filter((path) => {
    const value = path
      .split(".")
      .reduce<unknown>(
        (item, key) =>
          item && typeof item === "object"
            ? (item as Record<string, unknown>)[key]
            : undefined,
        record,
      );
    return value !== null && value !== undefined && value !== "unknown";
  });
  return {
    checked_numeric_date_claims: verification.checked_values,
    unsupported_numeric_date_claims: verification.violations.length,
    numeric_groundedness: verification.checked_values
      ? (verification.checked_values - verification.violations.length) /
        verification.checked_values
      : null,
    known_traps: fixture.known_traps.length,
    fabricated_traps: failedTraps,
    violations: verification.violations,
  };
}
