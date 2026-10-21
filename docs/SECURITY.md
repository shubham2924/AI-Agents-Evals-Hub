# Security notes

This is a local evaluation tool, but it still treats HTTP input, persisted JSON and Hermes output as untrusted boundaries.

## Database queries

Repositories use SQLite prepared statements. Every dynamic value is bound through a `?` placeholder:

```ts
database.prepare('SELECT ... WHERE id = ?').get(id);
database.prepare('INSERT INTO ... (id, name) VALUES (?, ?)').run(id, name);
```

No value from a request is concatenated into SQL. Reusable query fragments contain only hard-coded column names and clauses. Inserts list columns explicitly, related writes are transactional, foreign keys are enabled, and schema constraints provide a second line of defence.

The API integration suite submits `Support'); DROP TABLE task_sets; --` as a task-set name and verifies that it is stored literally and that the table remains available. This regression test demonstrates parameterisation; attempting to "clean" quotes out of user text would not provide the same protection.

## Input validation

- DTOs define required types, ranges, maximum lengths and maximum array sizes.
- Unknown request properties are rejected.
- Route IDs and model/provider identifiers use allow-listed formats.
- Skill/tool names are slug-only; resolved skill paths must remain under `sample/skills`.
- Regex scorer expressions must compile and pass a catastrophic-backtracking safety check.
- JSON scorer expectations must parse before persistence.
- Cross-entity rules, such as different baseline and candidate configurations, live in services.

## Hermes process boundary

- Hermes is spawned directly with an argument array and `shell: false`.
- Each observation receives an isolated profile directory.
- Execution has a hard timeout and bounded stdout, stderr, trace and model-output sizes.
- Captured errors are redacted for known API-key patterns before persistence or display.
- Temporary profiles are removed unless a developer explicitly enables retention.

## HTTP boundary

- Helmet applies standard response security headers.
- JSON request bodies are limited to 100 KB.
- CORS accepts only local Vite development origins.
- The production server listens on loopback by default.

## Out of scope

There is no authentication or tenant isolation. Do not expose this application to a shared network as-is. A hosted version would also require authorization, rate limiting, CSRF policy where cookie auth is used, audit logs, managed secrets and an execution sandbox for agent tools.
