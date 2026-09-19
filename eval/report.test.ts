import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scoreReport, type GoldenFixture } from "./judge";

describe("saved comparison report", () => {
  it("recomputes every saved score from its frozen fixture and model output", async () => {
    const root = process.cwd();
    const fixtures = JSON.parse(
      await readFile(join(root, "eval/fixtures/golden.json"), "utf8"),
    ) as GoldenFixture[];
    const report = JSON.parse(
      await readFile(join(root, "eval/reports/comparison.json"), "utf8"),
    ) as {
      fixtures: Array<Record<string, any>>;
    };
    for (const row of report.fixtures) {
      const fixture = fixtures.find((item) => item.symbol === row.symbol);
      expect(fixture).toBeDefined();
      if (!fixture?.expected_verified) {
        expect(row.refusal).toBe(true);
        continue;
      }
      for (const mode of ["single-call", "multi-agent"]) {
        expect(row[mode]?.output).toBeDefined();
        expect(row[mode]?.score).toEqual(
          scoreReport(row[mode].output, fixture),
        );
      }
      expect(row["multi-agent"]?.trace?.agents?.bull?.output).toBeDefined();
      expect(row["multi-agent"]?.trace?.agents?.bear?.output).toBeDefined();
    }
  });
});
