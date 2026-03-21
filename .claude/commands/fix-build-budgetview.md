---
description: "Diagnose and fix build/test failures in BudgetView"
---

# Fix Build BudgetView

Your job is to get this repository back to green safely.

Process:
1. Run the verification commands in this order:
   - `npm run build`
   - `npx vitest run`
   - `cargo test`
   - `cargo check`
2. Fix failures one by one, starting with the first real root cause.
3. After each meaningful fix, rerun the relevant command(s).
4. Stop only when everything passes or when blocked by an external issue.

Constraints:
- Avoid unrelated cleanup.
- Preserve existing behavior unless a bug requires change.
- If DB schema changes are needed, use migrations.
- If fixing a bug, add or update a test when practical.
- Never fake passing status.

At the end, summarize:
- root causes fixed
- files changed
- final command results
- any remaining risk
