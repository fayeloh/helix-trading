export type AgentRole = "bull" | "bear";

export interface DebateCase {
  thesis: string;
  claims: Array<{
    text: string;
    kind: "fact" | "inference";
    source: string | null;
    as_of: string | null;
    confidence: "high" | "medium" | "low" | null;
  }>;
  caveats: string;
}

export interface VerificationViolation {
  path: string;
  value: string | number;
  reason: string;
}

export interface VerificationResult {
  passed: boolean;
  checked_values: number;
  violations: VerificationViolation[];
}

export interface DebateTrace {
  architecture: "multi-agent" | "single-call-fallback";
  agents: {
    bull: { status: "completed" | "failed"; duration_ms: number; output?: DebateCase; error?: string };
    bear: { status: "completed" | "failed"; duration_ms: number; output?: DebateCase; error?: string };
    synthesizer: { status: "completed" | "failed" | "skipped"; model: string; error?: string };
  };
  verifier_result: VerificationResult;
  fallback_reason: string | null;
}

type AgentResult = DebateTrace["agents"][AgentRole];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return "unknown agent error";
}

async function runAgent(
  role: AgentRole,
  task: () => Promise<DebateCase>,
  timeoutMs: number,
): Promise<AgentResult> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const output = await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${role} agent timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    return { status: "completed", duration_ms: Date.now() - started, output };
  } catch (error) {
    return { status: "failed", duration_ms: Date.now() - started, error: errorMessage(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Minimal orchestration harness. Analyst agents run concurrently; synthesis is
 * only attempted when both perspectives complete. The legacy generator remains
 * the availability fallback.
 */
export async function runDebateHarness<T>(opts: {
  bull: () => Promise<DebateCase>;
  bear: () => Promise<DebateCase>;
  synthesize: (bull: DebateCase, bear: DebateCase) => Promise<T>;
  fallback: () => Promise<T>;
  verify: (output: T) => VerificationResult;
  synthesizerModel: string;
  timeoutMs?: number;
}): Promise<{ output: T; trace: DebateTrace }> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const [bull, bear] = await Promise.all([
    runAgent("bull", opts.bull, timeoutMs),
    runAgent("bear", opts.bear, timeoutMs),
  ]);

  const ready = bull.status === "completed" && bear.status === "completed";
  const fallbackReason = ready
    ? null
    : [bull.status === "failed" ? `bull: ${bull.error}` : null, bear.status === "failed" ? `bear: ${bear.error}` : null]
        .filter(Boolean)
        .join("; ");

  let output: T;
  let architecture: DebateTrace["architecture"] = ready ? "multi-agent" : "single-call-fallback";
  let finalFallbackReason = fallbackReason;
  let synthesizer: DebateTrace["agents"]["synthesizer"] = {
    status: ready ? "completed" : "skipped",
    model: opts.synthesizerModel,
  };
  if (ready) {
    try {
      output = await opts.synthesize(bull.output!, bear.output!);
    } catch (error) {
      const message = errorMessage(error);
      output = await opts.fallback();
      architecture = "single-call-fallback";
      finalFallbackReason = `synthesizer: ${message}`;
      synthesizer = { status: "failed", model: opts.synthesizerModel, error: message };
    }
  } else {
    output = await opts.fallback();
  }

  return {
    output,
    trace: {
      architecture,
      agents: {
        bull,
        bear,
        synthesizer,
      },
      verifier_result: opts.verify(output),
      fallback_reason: finalFallbackReason,
    },
  };
}

const NUMERIC_OR_DATE = /(?:\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?|[-+]?\d[\d,.]*\s*%?)/g;
const IGNORED_VERIFICATION_KEYS = new Set(["source", "source_url", "website"]);

function normalized(value: unknown): string {
  return (JSON.stringify(value) ?? String(value)).toLowerCase().replace(/[\s,$]/g, "");
}

/**
 * Checks numeric/date values asserted inside `kind: fact` objects against the
 * deterministic facts supplied to the model. This deliberately records only;
 * it never rewrites model output.
 */
export function verifyAgainstFacts(output: unknown, groundingFacts: unknown): VerificationResult {
  const haystack = normalized(groundingFacts);
  const violations: VerificationViolation[] = [];
  let checkedValues = 0;

  function visit(value: unknown, path: string, insideFact: boolean): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, insideFact));
      return;
    }
    if (!value || typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    const isFact = insideFact || record["kind"] === "fact";
    for (const [key, child] of Object.entries(record)) {
      if (key === "_facts" || key === "_debate" || IGNORED_VERIFICATION_KEYS.has(key)) continue;
      const childPath = path ? `${path}.${key}` : key;
      if (isFact && (typeof child === "number" || typeof child === "string")) {
        const tokens = String(child).match(NUMERIC_OR_DATE) ?? [];
        for (const token of tokens) {
          checkedValues += 1;
          const needle = normalized(token);
          if (needle.length > 0 && !haystack.includes(needle)) {
            violations.push({ path: childPath, value: token, reason: "not present in grounding facts" });
          }
        }
      } else {
        visit(child, childPath, isFact);
      }
    }
  }

  visit(output, "", false);
  return { passed: violations.length === 0, checked_values: checkedValues, violations };
}
