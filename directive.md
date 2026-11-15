# directive.md — Final Assessment

## Results

9 realistic scenarios, run with `npm run demo`. Full evidence: [evidence/report.md](evidence/report.md).

| Scenario | What the AI did | Verdict | Caught by |
|---|---|---|---|
| 01 | Built signup from the spec | 🟡 NEEDS_HUMAN | Risk gate (new high-risk feature, one-time sign-off) |
| 02 | Reworded an error message | ✅ AUTO_APPROVED | — (nothing sensitive changed) |
| 03 | Used an 8-char password minimum instead of 12 | ❌ BLOCKED | Spec-derived boundary test |
| 04 | Dropped email lower-casing in a refactor | ❌ BLOCKED | Spec normalisation test |
| 05 | Returned the password hash to the client | ❌ BLOCKED | `neverReturn` security test |
| 06 | Switched to MD5 hashing | ❌ BLOCKED | Security rules — **all 33 functional tests passed** |
| 07 | Strengthened hashing (correct change) | 🟡 NEEDS_HUMAN | Risk gate — human shown a 2-line diff |
| 08 | Started from a rough, incomplete spec | ❌ BLOCKED | Spec lint — 8 missing requirements, before any code ran |
| 09 | Stored raw signup input (incl. passwords) in an "analytics" list | ✅ AUTO_APPROVED ⚠️ | **Missed — see limitations** |

**Key numbers**

- **8 of 9** scenarios handled correctly; **4 of 5** real bugs blocked with no human involved.
- Human review needed for **2 of 9** changes — and in scenario 07 only **2 lines**.
- Full run of all 9 scenarios: **~21 seconds**. A single change: **under 5 seconds**. Well inside the sub-one-hour target.
- Test strength: spec-derived tests catch **94%** of planted bugs (34/36). Happy-path-only testing catches just **31%** (11/36) — the gate would reject it.
- The gate has its own test suite: **13/13 passing** (`npm test`).

## What worked

1. **Spec-first moved defects left.** Scenario 08 was stopped in 1 ms, before any code existed. That is the cheapest possible defect.
2. **Independent tests caught "plausible" AI mistakes.** Scenarios 03 and 04 are the kind of bugs a tired human reviewer approves — the code looks fine.
3. **Layers matter.** Scenario 06 passed every functional test. Only the static security rule caught it. No single technique is enough.
4. **The mutation check found real spec gaps.** The 2 surviving mutants exposed an actual ambiguity: the spec doesn't say if the 254-char email limit applies before or after trimming spaces. The gate found a question in the *requirements*, not just the code.
5. **Focused human review.** Instead of "review this PR", the human is told "review these 2 lines".

## Limitations (honest)

1. **The gate is only as good as the spec — scenario 09 proves it.** The AI kept every raw signup (including plain-text passwords) in memory. The spec never said "don't keep input elsewhere", no keyword matched (`recentSignups.push(input)`), and the tests only inspect the user store. It was auto-approved. **This is the most important finding:** keyword-based risk detection can be bypassed by innocent-looking names.
2. **Keyword risk detection is shallow.** It sees text, not meaning. It would also be fooled by renaming `password` to `pw`.
3. **Unit-level only.** No database, HTTP layer, concurrency (two simultaneous signups with the same email), or rate limiting.
4. **The line diff is simple.** Moved lines, or the same line in two places, can confuse it.
5. **Mutation operators are basic** (8 types). Real tools like Stryker have dozens.
6. **The AI implementations are simulated.** They reproduce real AI mistakes deterministically, but this prototype doesn't call a live model.
7. **Only one spec format and one feature.** Generalising the test generator to other features (e.g. payments, file upload) needs more rule types.

## Future improvements

| Priority | Improvement | Closes |
|---|---|---|
| 1 | **Secret taint tracking** — follow where `secret` inputs flow in the code (data-flow analysis), and flag any path that isn't hashing. | Scenario 09, keyword bypass |
| 2 | **AI reviewer for NEEDS_HUMAN** — a second, independent model explains the risky diff and suggests approve/reject, so the human decides in seconds. | Human time |
| 3 | **Live agent loop** — connect a real coding agent: feed BLOCKED feedback back automatically and retry until it passes or hits a retry limit. | Full autonomy |
| 4 | **Ticket → spec agent** — an AI drafts the spec from a rough ticket, using spec-lint messages as its checklist. | Spec writing effort |
| 5 | **Surviving mutants become spec questions** — automatically turn each blind spot into a question for the spec owner. | Spec gaps |
| 6 | **Production feedback** — when a bug escapes to production, add the rule to the spec so it can never pass again. | Learning over time |
| 7 | **Integration and concurrency tests** derived from the same spec (HTTP, database, race conditions). | Limitation 3 |

## Final take

Full autonomy isn't blocked by AI's ability to write code. It's blocked by **trust**. Trust comes from three things this prototype demonstrates:
**a precise spec as the source of truth, verification the AI can't influence, and measuring how good that verification is.**
With those in place, humans move from reviewing *everything* to approving the *spec once* and the *risky lines only*.
