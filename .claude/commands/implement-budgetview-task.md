---
description: "Implement a BudgetView task with planning, coding discipline, and verification"
argument-hint: "task to implement"
---

# Implement BudgetView Task

You are working inside the BudgetView Tauri repository.

Workflow:
1. Read the relevant files before editing.
2. Produce a short implementation plan.
3. Implement in small, coherent steps.
4. Add or update tests when the change affects behavior.
5. Run verification commands relevant to the touched areas:
   - `npm run build`
   - `npx vitest run`
   - `cargo test`
   - `cargo check`
6. Finish with a concise summary:
   - files changed
   - behavior added/fixed
   - remaining risk

Project constraints:
- UI text in French
- prefer safe financial handling
- preserve offline-first behavior
- use migrations for schema changes
- avoid broad unrelated refactors
- be careful with Tauri security settings

If blocked, explain the exact blocker instead of improvising around it.
