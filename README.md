# Agent Evals Platform

This project answers one question: **did a change to an AI agent make it better or worse?**

Think of it as an exam:

- The **tasks** are the exam questions.
- An **agent configuration** is the student: its model, instructions, skills, memory, and tools.
- **Hermes Agent** carries each question to the OpenAI model and returns its answer.
- This app scores the answers and shows which configuration performed better.

```text
Your browser -> this app -> Hermes -> OpenAI API
                              <- answer <-
             score + comparison <-
```

Hermes is not the model and does not replace OpenAI. It is the agent harness. The message about having no Hermes/Nous credits is irrelevant when using the direct OpenAI provider. You only need Hermes installed, an OpenAI API key, and funded OpenAI API billing for a real experiment.

The implementation is deliberately compact: NestJS, Vue 3, TypeScript and SQLite. There is no external database, Docker container, or queue to configure.

## First: run the free demo

Prerequisites: Node.js 22.5 or newer and npm.

```bash
cd /Users/shubhammetkar/Desktop/highlevel-agent-evals
npm install
npm run dev
```

Open <http://localhost:5173>. Leave the terminal running.

This demo works without an API key, without API credits, and even without calling Hermes. It uses saved sample results so you can understand the product first. Open **Support skill v1**, compare the two scores, select a task row, and inspect an individual run.

## Then: connect your OpenAI API key

An API key is like an account password; API credit is the money used for calls. Having a key does not guarantee that the API account has credit. ChatGPT Plus/Pro billing is also separate from API billing.

1. Check the OpenAI [API billing page](https://platform.openai.com/settings/organization/billing/overview). Add API credit if its balance is zero.
2. In a second terminal, from this repository, create your private settings file:

   ```bash
   cp .env.example .env
   ```

3. Open `.env` in your editor and set this line:

   ```text
   OPENAI_API_KEY=sk-your-real-key-here
   ```

   Do not paste the key into chat, screenshots, Git, or the README. `.env` is already ignored by Git.

4. Stop the running app with `Ctrl+C`, then restart it:

   ```bash
   npm run dev
   ```

You do not need to open the interactive `hermes` command. The NestJS backend runs `hermes chat ...` itself whenever you choose the **Hermes Agent** runner.

## Run your first real experiment

In <http://localhost:5173>:

1. Click **New experiment**.
2. Keep **General assistant** as baseline and **Support specialist** as candidate.
3. Choose **Hermes Agent** as the runner.
4. Set repetitions to **1** for the first inexpensive test. That means 5 tasks × 2 configurations = 10 OpenAI calls.
5. Create the experiment, open it, and click **Run experiment**.
6. Wait until it finishes. Open a task and then a run to see the prompt, model answer, score, and any error.

The supplied configurations use Hermes provider `openai-api` and model `gpt-5.4-mini`. Hermes reads `OPENAI_API_KEY` from the backend process. If the key is missing, the run trace now tells you exactly how to fix it.

## What Hermes is doing

For every task and configuration, the backend creates a clean temporary Hermes profile. It adds the selected system instruction, memory setting, skill, and safe tools, then launches:

```text
hermes chat --oneshot --query <task> --format stream-json \
  --provider openai-api --model gpt-5.4-mini
```

Hermes calls OpenAI, emits structured trace events, and exits. The backend stores the answer, latency, token count, estimated cost, tool activity, and scoring result in SQLite. Isolating every run prevents one configuration's memory from leaking into another.

## Common problems

- **The website does not open:** confirm both `api` and `web` lines are running in the terminal, then use <http://localhost:5173>.
- **`OPENAI_API_KEY is missing`:** create `.env` in the repository root and restart `npm run dev`.
- **OpenAI says quota/credit is exhausted:** add credit in OpenAI API billing. Hermes/Nous credits do not fix direct OpenAI billing.
- **`spawn hermes ENOENT`:** the app cannot find the Hermes executable. Run `which hermes`; put the returned full path after `HERMES_BIN=` in `.env`, then restart.
- **A real experiment fails:** open an individual run. Its final red trace item contains the provider or Hermes error.

## Developer commands

Useful checks:

```bash
npm test
npm run typecheck
npm run build
```

The production build is served by NestJS:

```bash
npm run build
npm start
# open http://localhost:3000
```

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
docs/                 Design, limits, costs, results
```

## Assumptions

- Tasks in one set are independent; repetitions capture model nondeterminism.
- Baseline and candidate runs are paired by task and repetition.
- Scorers are deterministic and return a score in `[0, 1]` (the current built-ins are binary).
- A configuration's provider credentials are supplied to the backend process, not stored by this product.
- The local demo runner is a workflow fixture, not evidence about model quality. It is visibly labeled in the UI and trace.
- The default concurrency of two is conservative. Change `RUN_CONCURRENCY` for a provider's rate limits.

See [Design](docs/DESIGN.md), [Known limits](docs/KNOWN_LIMITS.md), [Costs](docs/COSTS.md), and [Experiment results](docs/EXPERIMENT_RESULTS.md).
