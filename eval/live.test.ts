import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateFundamentalsFromSnapshot } from "../src/lib/research.server";
import { scoreReport, type GoldenFixture } from "./judge";

describe.skipIf(process.env["HELIX_LIVE_EVAL"] !== "1")(
  "same-snapshot model comparison",
  () => {
    it("runs baseline and debate against identical frozen public data", async () => {
      const fixtures = JSON.parse(
        await readFile(
          join(process.cwd(), "eval", "fixtures", "golden.json"),
          "utf8",
        ),
      ) as GoldenFixture[];
      const results = [];
      for (const fixture of fixtures) {
        if (!fixture.expected_verified) {
          expect(fixture.snapshot).toBeUndefined();
          results.push({ symbol: fixture.symbol, refusal: true });
          continue;
        }
        if (!fixture.snapshot)
          throw new Error(`Missing snapshot for ${fixture.symbol}`);
        const snapshot = fixture.snapshot as Parameters<
          typeof generateFundamentalsFromSnapshot
        >[0];
        const byMode: Record<string, unknown> = {};
        for (const mode of ["single-call", "multi-agent"] as const) {
          const start = Date.now();
          try {
            const result = await generateFundamentalsFromSnapshot(
              snapshot,
              mode,
            );
            byMode[mode] = {
              score: scoreReport(result.output, fixture),
              output: result.output,
              ...(result.trace ? { trace: result.trace } : {}),
              duration_ms: Date.now() - start,
              architecture: result.trace?.architecture ?? mode,
            };
          } catch (error) {
            byMode[mode] = {
              error: error instanceof Error ? error.message : String(error),
              duration_ms: Date.now() - start,
            };
          }
        }
        results.push({ symbol: fixture.symbol, ...byMode });
      }
      const directory = join(process.cwd(), "eval", "reports");
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, "comparison.json"),
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            metric_scope:
              "numeric/date fact claims and masked-null traps only; not semantic groundedness",
            fixtures: results,
          },
          null,
          2,
        ) + "\n",
      );
      expect(results).toHaveLength(3);
      for (const row of results.slice(0, 2)) {
        expect(row["single-call"]).toHaveProperty("score");
        expect(row["multi-agent"]).toHaveProperty("score");
      }
    }, 300_000);
  },
);
