# Spec Gate — trust AI-written code without reviewing all of it

A spec-driven quality gate that decides, on its own, whether an AI-written change
**ships** ✅, **goes back to the AI** ❌, or **needs a human** 🟡 — and when a human is needed, shows them only the lines that matter.

Demo feature: **user signup** (email, username, password).

## Run it (Node.js 18+, no install needed)

```bash
npm run web      # dashboard: http://localhost:3000   signup page: http://localhost:3000/signup
npm run demo     # run all 9 scenarios, writes evidence/report.md
npm test         # test the gate itself (13 tests)
npm run gate -- changes/06-ai-bug-md5.json   # check one change (exit code 0/1/2)
```

## Read in this order

1. [intent.md](intent.md) — the problem and why it matters
2. [approach.md](approach.md) — architecture and design decisions
3. [evidence/report.md](evidence/report.md) — results of every scenario
4. [directive.md](directive.md) — results, limitations, future work

## Repository map

```
specs/              the source of truth (complete + deliberately rough spec)
pipeline/           the 5 gate stages + CLI
  spec-lint.js        1. reject vague specs
  security-rules.js   2. hard security rules
  derive-tests.js     3. tests generated from the spec
  mutation-check.js   4. test the tests
  risk-gate.js        5. decide if a human is needed
  gate.js / run.js    combine stages, print + write report
implementations/    "AI-written" versions of signup (one good, several realistic mistakes)
changes/            9 scenarios, each with its expected verdict
tests/              tests for the gate itself
evidence/           generated report and raw results
```

## Results at a glance

| | |
|---|---|
| Real AI bugs blocked automatically | 4 / 5 |
| Changes needing a human | 2 / 9 (one of them: a 2-line review) |
| Test strength (mutation score) | 94% vs 31% for happy-path-only tests |
| Time for all 9 scenarios | ~21 seconds |
| Known misses | 1 — documented in [directive.md](directive.md) |
