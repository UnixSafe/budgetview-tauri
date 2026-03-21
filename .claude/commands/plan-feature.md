---
description: "Plan a BudgetView feature before coding"
argument-hint: "feature or problem statement"
---

# Plan BudgetView Feature

You are planning work for **BudgetView Tauri**.

Context:
- Stack: **Tauri 2 + Svelte 5 + SvelteKit + TailwindCSS 4 + Rust + SQLite**
- Domain: personal finance / budgeting
- Language: UI text in **French**
- Data safety matters: avoid destructive changes, preserve user data, prefer migrations over ad-hoc schema edits

When given a feature or bug, do this:

1. Read the relevant existing files first.
2. Identify impacted layers:
   - Svelte routes/components/stores
   - Rust commands/db/import logic
   - SQLite migrations/schema
   - tests (Vitest + Rust)
3. Call out domain constraints explicitly:
   - money should be handled safely
   - confirmation before destructive actions
   - preserve offline-first behavior
   - avoid SQL injection / unsafe dynamic SQL
4. Produce a concrete plan with:
   - goal
   - touched files
   - implementation steps
   - risks / edge cases
   - verification commands
5. Keep the plan practical and repo-specific, not generic.

Default verification commands to mention when relevant:
- `npm run build`
- `npx vitest run`
- `cargo test`
- `cargo check`
