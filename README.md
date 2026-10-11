# Agent Evals Platform

A small evaluation control plane for [Hermes Agent](https://github.com/NousResearch/hermes-agent). It runs the same task set against two agent configurations, applies deterministic scorers, estimates the paired effect with a bootstrap confidence interval, and keeps enough trace data to explain individual failures.

The implementation is deliberately compact: NestJS, Vue 3, TypeScript and SQLite (through Node's built-in `node:sqlite`). There is no external database or queue to configure.

## Run locally

Prerequisites: Node.js 22.5 or newer and npm.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The API runs on <http://localhost:3000>. A seeded experiment is already complete, and new experiments can use the `demo` runner without credentials.

Useful checks:

```bash
npm test
npm run typecheck
npm run build
```

The production build is served by Nest:

```bash
npm run build
npm start
# open http://localhost:3000
```

## Run a real Hermes experiment

1. Install and configure Hermes Agent using its [official instructions](https://hermes-agent.nousresearch.com/docs/quickstart/).
2. Export the provider credential in the shell that starts this app (for the sample configuration, `OPENROUTER_API_KEY`). Keeping credentials in the process environment means this repository never copies them into SQLite.
3. Start the app, create an experiment, choose `Hermes Agent` as the runner, then click **Run experiment**.

For each run the backend creates an isolated directory under `data/hermes-profiles/<experiment>/<configuration>/<run>/`. It writes `SOUL.md`, memory settings, and local skill files there, then invokes:

```text
hermes chat --oneshot --query <prompt> --format stream-json \
  --provider <provider> --model <model> --toolsets <tools> --skills <skills>
```

Arguments are passed directly to `spawn` (no shell interpolation). Model text, tool calls, tool results, tokens, latency and failures are stored as the run trace. `HERMES_BIN` can point at a non-default Hermes executable.

## What is included

- A five-task customer-support suite with exact, contains, and JSON scorers.
- Baseline and support-specialist configurations varying skill instructions and memory.
- A deterministic demo runner for a zero-credential product walkthrough.
- A Hermes runner using the supported one-shot JSONL CLI surface.
- SQLite persistence, validation, bounded concurrency and rerunnable experiments.
- Paired, seeded non-parametric bootstrap with a 95% confidence interval.
- Experiment, task/configuration, per-task comparison, and individual trace screens.

## Repository map

```text
apps/api/             NestJS API, runners, scoring, statistics, SQLite
apps/web/             Vue 3 + TypeScript interface
packages/shared/      Shared API types
sample/skills/        Local Hermes skill used by the sample candidate
docs/                 Design, limits, costs, results and video outline
```

## Assumptions

- Tasks in one set are independent; repetitions capture model nondeterminism.
- Baseline and candidate runs are paired by task and repetition.
- Scorers are deterministic and return a score in `[0, 1]` (the current built-ins are binary).
- A configuration's provider credentials are supplied to the backend process, not stored by this product.
- The local demo runner is a workflow fixture, not evidence about model quality. It is visibly labeled in the UI and trace.
- The default concurrency of two is conservative. Change `RUN_CONCURRENCY` for a provider's rate limits.

See [Design](docs/DESIGN.md), [Known limits](docs/KNOWN_LIMITS.md), [Costs](docs/COSTS.md), and [Experiment results](docs/EXPERIMENT_RESULTS.md).
