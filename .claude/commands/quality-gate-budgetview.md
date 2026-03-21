---
description: "BudgetView quality gate before finishing a task"
argument-hint: "optional scope or task summary"
---

# BudgetView Quality Gate

Before considering the work done, run a focused quality gate for this repository.

Scope:
- Tauri 2
- Svelte 5 / SvelteKit
- Rust backend
- SQLite migrations
- Financial UI and data correctness

Process:
1. Re-state the task/scope in one short sentence.
2. Inspect the changed files and identify impacted areas:
   - frontend UI/components/routes
   - stores/utils
   - Rust commands/db/import
   - migrations/config
3. Run the relevant verification commands:
   - `npm run build`
   - `npx vitest run`
   - `cargo test`
   - `cargo check`
4. Do a manual review for:
   - money handling correctness
   - French UI consistency
   - destructive actions needing confirmation
   - SQL safety / transaction safety
   - Tauri config/security regressions
5. Return a short verdict:
   - PASS
   - PASS WITH RISKS
   - FAIL

Output:
- Verdict
- Checks run
- Risks found
- Next smallest fix

Never say PASS if required checks were skipped or failed.
