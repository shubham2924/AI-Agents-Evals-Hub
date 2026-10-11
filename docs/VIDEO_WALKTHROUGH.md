# Video walkthrough outline

Use this as a three-minute recording checklist after verifying the app locally.

1. **00:00 — Problem and experiment list.** Explain that each row compares two Hermes configurations on paired tasks. Point out scores, change and runner label.
2. **00:30 — Aggregate evidence.** Open “Support skill v1.” Show baseline/candidate means, the 95% interval, probability of improvement, and per-task breakdown.
3. **01:10 — Failure inspection.** Open a failed baseline run. Show the prompt, response, deterministic scorer reason, token count and latency.
4. **01:40 — Configuration surface.** Show model, skills, memory and tools on the Configurations page, then the scorer definitions under Task sets.
5. **02:10 — Execute.** Create a three-repetition demo experiment and run it. Show queued/running rows update and the completed result.
6. **02:40 — Hermes path.** Briefly show the README command and explain that choosing “Hermes Agent” swaps the demo adapter for `hermes chat --format stream-json` with isolated profiles.

Before submitting, record this flow with your voice, upload an unlisted video, and put its URL at the top of this file. A human-recorded explanation is preferable to a synthetic narration for a take-home assignment.
