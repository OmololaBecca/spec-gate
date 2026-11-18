# intent.md — Problem Definition

## The problem

**AI can write code in minutes, but teams still review it by hand for hours, because nobody trusts the green tick. The AI often wrote the tests too, so the tests just agree with the code.**

## What I observed

When an AI agent implements a feature today, the usual flow is:

```
rough ticket → AI writes code → AI (or dev) writes tests → tests pass → human reviews everything
```

Every step looks automated, but the last step — the human review — is where all the real trust lives. That is why lead time stays in hours or days, not minutes.

## Root causes

| # | Root cause | What goes wrong |
|---|---|---|
| 1 | **Requirements are vague.** | A ticket says "users sign up with email and password". The AI silently guesses the rest: password length, duplicate emails, what is returned. Guesses become bugs. |
| 2 | **Tests are written from the code, not from the requirement.** | If the AI picks an 8-character password minimum, it writes a test for 8. The test passes. Both are wrong. |
| 3 | **Nobody checks the checker.** | A test suite can be 100% green and still miss almost everything. There is no signal for "how good are these tests?" |
| 4 | **Some dangerous code passes every functional test.** | MD5 password hashing *works*. Tests can't see it is insecure. |
| 5 | **Every change gets the same review.** | A typo fix waits in the same review queue as a change to password hashing. Human attention is spread thin and wasted. |

## What I'm proposing

A **quality gate driven by a machine-readable specification**, which decides on its own whether a change:

- ✅ **AUTO_APPROVED** — ships with zero human time
- ❌ **BLOCKED** — goes straight back to the AI agent with precise feedback to fix
- 🟡 **NEEDS_HUMAN** — passed everything, but touches sensitive code, so a human reviews *only the changed sensitive lines*

Each root cause maps to one stage:

| Root cause | Stage that addresses it |
|---|---|
| 1. Vague requirements | **Spec lint** — rejects a spec with missing answers before code is written |
| 2. Tests agree with the code | **Spec-derived tests** — generated from the spec, the AI never writes them |
| 3. Nobody checks the checker | **Mutation check** — plants bugs; if tests don't catch them, the tests aren't trusted |
| 4. Dangerous-but-working code | **Security rules** — hard rules that override passing tests |
| 5. Review everything equally | **Risk gate** — only sensitive *changes* go to a human |

## Domain chosen: user signup

This is a user signup feature built by AI, but full of real risk: password storage, data leaks, duplicate accounts, input validation.

## Assumptions

- A spec can be written in a structured format. In a real team, an AI could help turn a rough ticket into this spec, and the spec lint tells it what is still missing.
- The spec is reviewed by a human **once**, when it is created. After that, the spec is the source of truth, not individual code reviews.
- The "AI-written" implementations in this repo are hand-crafted to reproduce realistic AI mistakes, so results are repeatable. In production, an agent would generate them.
- Humans stay in the loop for high-risk changes. The goal is **near-zero** intervention, not zero — and to make the remaining human time small and focused.

## Success criteria

1. Realistic AI bugs are blocked automatically, with feedback precise enough to fix without a human.
2. Safe changes ship with no human involved.
3. Risky changes reach a human with only the lines that matter.
4. The gate measures the strength of its own tests.
5. A full run takes seconds, not hours (target: well under one hour lead time).
6. The gate is honest about what it misses.
