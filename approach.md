# Technical Approach

## Architecture

```
                    ┌──────────────────────┐
  rough ticket ───▶ │  signup.spec.json    │  (human approves the spec ONCE)
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
               1    │      Spec lint       │──── incomplete ───▶ BLOCKED (fix the spec)
                    └──────────┬───────────┘
                               │ spec is complete
        AI agent writes code   │
                    ┌──────────▼───────────┐
               2    │   Security rules     │──┐
                    └──────────┬───────────┘  │
                    ┌──────────▼───────────┐  │
               3    │  Spec-derived tests  │──┼── any failure ───▶ BLOCKED
                    └──────────┬───────────┘  │   + feedback sent back to the AI agent
                    ┌──────────▼───────────┐  │
               4    │   Mutation check     │──┘   (are the tests strong enough?)
                    └──────────┬───────────┘
                               │ all passed
                    ┌──────────▼───────────┐
               5    │      Risk gate       │──── sensitive lines changed ───▶ NEEDS_HUMAN
                    └──────────┬───────────┘     (human sees only those lines)
                               │ nothing sensitive
                               ▼
                         AUTO_APPROVED
```

## The specification is the centre of everything

[specs/signup.spec.json](specs/signup.spec.json) defines what "correct" means:

- **inputs** — type, required, min/max length, pattern, format, uniqueness, normalisation, secret
- **example** — one valid input that tests are built from
- **responses** — status codes for success, bad input and duplicates
- **security** — how secrets are stored, what must never be returned, forbidden code patterns, and which keywords mark code as sensitive
- **riskLevel** — how much human oversight the feature needs

The code is checked against the spec, never against itself.

## The five stages

| Stage | File | What it does | Design decision |
|---|---|---|---|
| 1. Spec lint | [pipeline/spec-lint.js](pipeline/spec-lint.js) | Checks the spec answers the questions an AI would otherwise guess: max lengths, duplicate handling, normalisation, secret handling | Defects are cheapest to fix *before* code exists. Each message is phrased as the missing question. |
| 2. Security rules | [pipeline/security-rules.js](pipeline/security-rules.js) | Scans code for forbidden patterns (MD5, SHA-1, `eval`, `console.log` in signup, `Math.random`) | Hard rules override passing tests. Some insecure code works perfectly. |
| 3. Spec-derived tests | [pipeline/derive-tests.js](pipeline/derive-tests.js) | Generates 33 tests from the spec: boundaries (min-1, min, max, max+1), missing/blank/wrong-type fields, bad formats, duplicates, normalisation, leaked secrets, plain-text and unsalted storage | The AI never writes these tests, so it can't "agree with itself". Add a rule to the spec → tests appear automatically. |
| 4. Mutation check | [pipeline/mutation-check.js](pipeline/mutation-check.js) | Plants 36 small bugs (flip `<` to `<=`, drop `.toLowerCase()`, skip hashing, change status codes…) and re-runs the tests. Score must be ≥ 85%. | Answers *"what happens when validation misses a problem?"* — the gate measures its own blind spots and reports them. |
| 5. Risk gate | [pipeline/risk-gate.js](pipeline/risk-gate.js) | Compares the change with the last human-approved version. Changed lines that touch sensitive keywords → human review. | Human attention is spent on risk, not volume. The human sees a 2-line diff, not a whole file. |

The gate ([pipeline/gate.js](pipeline/gate.js)) combines these into one verdict. The CLI ([pipeline/run.js](pipeline/run.js)) returns exit codes `0 / 1 / 2` (approved / blocked / needs human), so it drops straight into any CI system.

## The autonomous correction loop

When a change is blocked, the gate produces feedback written for the AI agent, linked to the spec rule that failed:

```
[test] password-below-min (inputs.password.minLength): expected status 400, got 201
[security] line 9: "md5" - MD5 is broken and must never be used for passwords
```

That is enough for an agent to fix its own code and resubmit — without a human reading the failure.

## Other design decisions

- **Zero dependencies.** Plain Node.js (≥18), built-in test runner. Nothing to install, nothing to trust in the supply chain.
- **Spec as JSON, not prose.** Machines can lint it, derive tests from it and diff it.
- **The gate is tested too.** Every scenario in [changes/](changes/) declares its expected verdict, and [tests/pipeline.test.js](tests/pipeline.test.js) fails if the gate disagrees.
- **Fail closed.** An exception in the code under test counts as a test failure, never a pass.

## How a real team would use it

1. Product writes a rough ticket. An AI drafts the spec. **Spec lint** lists what is missing; the AI or a human fills it in. A human approves the spec once.
2. AI agents implement changes (in parallel, if needed — each change is checked independently).
3. The gate runs on every change in CI. Blocked changes loop back to the agent automatically.
4. Humans only see `NEEDS_HUMAN` changes, with the exact lines to review.
5. Every human-approved version becomes the new baseline for the risk gate.
