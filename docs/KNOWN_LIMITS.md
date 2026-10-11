# Known limits

1. The worker queue is in-process. SQLite preserves rows, but a server restart does not automatically resume queued work. A production deployment should use a durable queue and leases.
2. One backend instance is assumed. There is no distributed lock around an experiment.
3. Task/configuration creation is available through the API; the compact UI focuses on viewing seeded definitions and creating/running comparisons.
4. Scorers are binary and deterministic. They do not assess style, semantic equivalence, or open-ended quality.
5. The bootstrap treats task/repetition pairs as exchangeable. Very small or highly correlated suites can produce misleading certainty; report task-level slices and add tasks before trusting a launch decision.
6. Hermes credentials must already be available in the backend environment. The app does not provide OAuth or secret management.
7. Tool calls run with the permissions of the Hermes configuration. The sample uses the `safe` toolset; untrusted task sets need a container/sandbox policy.
8. Cost estimation has an explicit price entry only for the sample model and excludes separately billed tools. Unknown models report `$0` rather than a fabricated price. Production should ingest Hermes' model catalog/usage totals.
9. Trace tool outputs are capped by Hermes' JSONL interface and should not be treated as a complete artifact store.
10. There is no authentication because the server binds to loopback for local use. Authentication, tenant isolation, audit logs and CSRF controls are required before a shared deployment.
11. The included experiment uses the deterministic demo adapter. It validates the platform workflow, not the quality of a hosted model; run the documented Hermes experiment before using results for a model decision.
