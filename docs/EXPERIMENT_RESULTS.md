# Included experiment results

## Question

Does adding a support-triage skill and memory improve performance over the general configuration on the five sample customer-support tasks?

## Method

- Task set: `Customer support essentials` (5 tasks)
- Repetitions: 3
- Observations: 15 paired task/repetition results
- Baseline: general instruction, memory off, no domain skill
- Candidate: support instruction, memory on, `support-triage` skill
- Scoring: exact/contains/JSON deterministic checks
- Interval: paired bootstrap, 10,000 resamples, fixed seed

## Recorded result

| Configuration | Mean score |
|---|---:|
| General assistant | 40% |
| Support specialist | 100% |

Observed change: **+60 percentage points** with a paired bootstrap 95% interval of **+33 to +87 points**. The candidate fixes urgent routing, safe security escalation, and refusal to invent account credit.

## Interpretation

This seeded record is an executed **demo-adapter** experiment. It proves the orchestration, pairing, scoring, statistics, persistence and inspection workflow deterministically; it is not evidence that a hosted model improved. That distinction is visible in the experiment metadata and every run trace.

For decision-grade evidence, follow “Run a real Hermes experiment” in the README, select the Hermes runner, and replace this section with the provider-backed result. The task set and comparison method stay unchanged, so the run is directly reproducible subject to model nondeterminism.
