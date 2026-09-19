# Fundamentals Harness + Multi-Agent

`generateResearchSection({ section: "fundamentals" })` now uses a small in-process
Harness instead of one direct model call:

1. Fetch and freeze deterministic grounding facts (symbol resolution and company profile).
2. Run Bull and Bear analysts concurrently with the fast model.
3. Pass both structured cases to a Deep-model Synthesizer that emits the existing
   `FUNDAMENTALS_SCHEMA`, so the current UI and cache remain compatible.
4. Run `verifyAgainstFacts()` against numeric/date claims marked `kind: "fact"`.
   A failed synthesis is retried once with the violations, then falls back to
   the single-call path. If the final output still fails, no report is returned.
5. If either analyst times out/fails, or synthesis fails, call the original single
   Deep-model generator and record `architecture: "single-call-fallback"`.

The payload includes `_debate` with agent status, durations, fallback reason, and
verifier output. Fundamentals cache entries are versioned so old single-call
reports do not mask this pipeline. `_facts` remains unchanged.

## Market data display semantics

The global index globe keeps data availability separate from direction. A positive
`changePct` is shown as up, a negative value as down, and `null` or non-finite
values as unknown. Unknown values are rendered in gray with `—`; they are never
coerced to zero or presented as an up move.

## Evaluation

`npm run eval:record` records public AAPL and CRWV profile facts and the ZZZZZZ
refusal path into `eval/fixtures/golden.json`. The two verified profiles have
`employees` deliberately masked to `null` as a known trap. `npm run eval:live`
uses that same frozen input for the legacy single call and the debate pipeline,
writing model outputs and scores to `eval/reports/comparison.json`. These opt-in
commands use `.env.local` and external APIs; ordinary `npm test` stays offline.

The current judge checks numeric/date `kind: fact` claims and the masked-null
trap only. It does not validate semantic claims, source attribution, debate
quality, or cost. The latest same-snapshot run found no fabricated masked-null
trap for either AAPL or CRWV. After excluding rounded `company_profile.market_cap`
(overwritten from the trusted profile), AAPL scored 10/10 for single-call and
8/8 for Multi-Agent; CRWV scored 1/1 and 2/2. Because the sample is small and
the two architectures produced different numbers of claims, these results do
not prove a general quality improvement. See `docs/mvp-eval-summary.md` for
manual review. The optional Phase 3 and CI quality regression gate remain
future work.

## Minimum engineering gate

Run the following command before committing Harness or research workflow changes:

```bash
npm run verify
```

The gate passes only when Harness-scoped ESLint, project-wide TypeScript
checking, and all Vitest tests pass. The current baseline is 9 test files and
90 passing tests, with 2 opt-in recording/live-evaluation tests skipped by
default. The Harness smoke tests cover the multi-agent success path, analyst
failure fallback, synthesizer failure fallback, verifier retry/rejection,
grounded fact verification, and the boundary between facts and inferences.
The existing full-project `npm run lint` command remains available, but its
pre-existing repository-wide formatting backlog is intentionally outside this
MVP gate.
