# Approximate running costs

The application itself is effectively free locally: one Node process, SQLite, and short-lived Hermes child processes. Disk use is mostly traces; a small 30-run experiment is typically well below 10 MB.

Model spend is approximately:

```text
runs × ((input tokens × input $/M) + (output tokens × output $/M)) / 1,000,000
```

For the sample matrix (5 tasks × 2 configurations × 3 repetitions = 30 runs), assuming 1,000 input and 150 output tokens per run and the configured GPT-5.4 mini rates of $0.75/M input and $4.50/M output:

```text
30 × ((1,000 × $0.75) + (150 × $4.50)) / 1,000,000 ≈ $0.043
```

A larger 100-task suite with five repetitions and two configurations is 1,000 runs. At the same token profile it is roughly **$1.43**. Agentic tasks can cost much more because every tool iteration adds another model call and more context.

These are budgeting examples, not price quotes. Provider/model prices change. The run table records tokens and an estimated model cost when a known price is configured; separately billed web search, browser services, sandboxes and other tools are not included. Set a provider budget and begin with one repetition before launching a large experiment.
