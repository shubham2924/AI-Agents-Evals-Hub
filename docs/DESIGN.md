# Design document

## Goals

The platform should make a narrow claim with evidence: configuration B performed differently from configuration A on a versioned set of tasks. It should also make that claim inspectable. A reviewer must be able to move from the aggregate result to the exact prompt, model response, tool activity, and scorer decision.

## Architecture

```text
Vue client
   │ REST + polling
NestJS API ─── SQLite
   │
Experiment runner
   ├── Demo adapter (offline workflow fixture)
   └── Hermes adapter ── spawned `hermes chat` process per run
                              │ JSONL events
                              └── model, skills, memory and tools
```

The Nest process owns orchestration. Starting an experiment materializes all `(task × config × repetition)` rows as `queued`, then a small worker pool processes them. This is intentionally in-process for a local take-home: the state is durable, while the executor is simple enough to understand in one sitting.

The API is organised by domain rather than by technical file type:

```text
apps/api/src/
├── task-sets/       controller → service → repository
├── agent-configs/   controller → service → repository
├── experiments/     controller → service → repository + orchestrator
├── runners/         demo and Hermes execution adapters
├── evaluation/      deterministic scoring and comparison statistics
├── common/          configuration, database, migrations and validation
├── seed/            repeatable sample-data setup
└── health/          operational health endpoint
```

Controllers only translate HTTP requests and responses. Services enforce business rules. Repositories own SQL and row mapping. Runner adapters isolate external-process concerns, while evaluation functions remain pure and independently testable. This separation keeps database, transport and Hermes details out of the domain logic.

Hermes is invoked through its documented `chat --oneshot --format stream-json` interface. This keeps the TypeScript product decoupled from Hermes' Python internals while retaining structured system, tool, result and token events. Each observation gets a separate `HERMES_HOME` directly under Hermes' official `~/.hermes/profiles` directory; therefore memory, sessions, and installed skills cannot leak across candidates or repetitions, while profiles still share the managed Hermes runtime. The temporary profile is removed after its structured trace is stored; `KEEP_HERMES_PROFILES=true` retains it for debugging.

## Data model

- `task_sets` and `tasks`: prompt plus scorer type, expected value and weight.
- `agent_configs`: provider/model, skills, memory flag, toolsets and system instruction.
- `experiments`: the immutable comparison definition and lifecycle state.
- `runs`: one observation with output, binary score, timing, tokens, cost estimate and JSON trace.

SQLite uses WAL mode, foreign keys, a busy timeout and versioned migrations. Multi-row writes use explicit transactions. JSON is used only for naturally nested data (tool trace and string lists); comparison-critical fields stay relational.

All request-derived database values use prepared statements and bound parameters (`?`). SQL fragments are static constants owned by repositories; user input is never interpolated into a query. Inserts name their columns explicitly, rows have concrete TypeScript interfaces, and persisted JSON is parsed through checked boundary helpers instead of unchecked casts.

## Request and process safety

DTO validation is a trust boundary, not a replacement for query parameterisation. The global validation pipe strips no data silently: it rejects unknown properties, transforms validated DTOs, trims strings and enforces length/range/array limits. Services additionally validate cross-record rules, JSON scorer values and regular expressions. Potentially exponential regular expressions are rejected.

Route identifiers are validated before reaching a repository. Hermes skill names use a slug-only format and receive a second resolved-path containment check before a file is copied. The Hermes child process is spawned with `shell: false`, bounded output buffers and a hard timeout. API keys stay in the environment, known secret patterns are redacted from captured errors, and temporary Hermes profiles are deleted by default.

HTTP responses use Helmet security headers. Request bodies are limited to 100 KB, and development CORS is restricted to the local Vite origins. The service deliberately binds to loopback because authentication is outside this local assignment's scope.

## Scoring

Four deterministic scorers are supported:

- `exact`: case-insensitive comparison after whitespace normalization.
- `contains`: every `|`-separated phrase must occur.
- `regex`: case-insensitive JavaScript regular expression.
- `json`: parsed structural equality with recursively sorted object keys.

Deterministic scoring makes regressions reproducible and avoids using the same class of model as both subject and judge. A production extension could add rubric/LLM judging, but it should store judge model/version and periodically measure agreement against human labels.

## Statistics

Runs are paired on `(task, repetition)`, then candidate-minus-baseline differences are bootstrapped 10,000 times with a fixed PRNG seed. The UI reports:

- each configuration's mean score;
- absolute percentage-point change;
- percentile 95% confidence interval;
- bootstrap probability that the change is positive.

“Better” requires the entire interval to be above zero, “worse” requires it below zero, and all other results are “inconclusive.” Pairing removes task difficulty from the comparison. The fixed seed makes identical run data produce identical reports.

## Operational decisions

- **Polling over WebSockets:** an experiment is small and update frequency is low. One-second polling is reliable and easy to review.
- **One process per run:** isolates Hermes sessions and makes timeout/exit handling explicit.
- **No credential database:** provider credentials stay in process environment/Hermes auth. This limits the blast radius of the app database.
- **Built-in SQLite:** gives transactional durability without Docker or native npm modules; it requires Node 22.5+.
- **Demo adapter:** enables a complete reviewer walkthrough without spending money. Its UI and trace labels explicitly prevent confusing it with a model experiment.

## Failure behavior

Hermes has a configurable process timeout (five minutes by default). Non-zero exits become `error` runs and preserve redacted, size-bounded diagnostics. An experiment containing any error ends as `failed`; successfully scored runs remain inspectable. A rerun clears that experiment's old run rows before enqueueing a fresh matrix.

## Test strategy

- Pure unit tests cover scorers and paired bootstrap comparison.
- HTTP integration tests boot the real Nest application against a temporary SQLite database.
- The integration suite checks the seeded endpoints, security headers, strict input validation, unsafe regex/path rejection, a complete experiment lifecycle, and an SQL-metacharacter payload that remains ordinary data.
- Frontend tests cover the typed API client's success and error contracts.
- Lint, format checking, strict TypeScript checking and production builds are exposed as repository-level commands.
