# Fundamentals Harness + Multi-Agent

`generateResearchSection({ section: "fundamentals" })` now uses a small in-process
Harness instead of one direct model call:

1. Fetch and freeze deterministic grounding facts (symbol resolution and company profile).
2. Run Bull and Bear analysts concurrently with the fast model.
3. Pass both structured cases to a Deep-model Synthesizer that emits the existing
   `FUNDAMENTALS_SCHEMA`, so the current UI and cache remain compatible.
4. Run `verifyAgainstFacts()` against numeric/date claims marked `kind: "fact"`.
   Violations are recorded, never silently rewritten.
5. If either analyst times out/fails, or synthesis fails, call the original single
   Deep-model generator and record `architecture: "single-call-fallback"`.

The payload includes `_debate` with agent status, durations, fallback reason, and
verifier output. `_facts` remains unchanged. This keeps the migration observable
and reversible while allowing the Harness to be evaluated independently.
