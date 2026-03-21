---
description: "Review BudgetView changes with finance + Tauri + Svelte focus"
argument-hint: "optional scope (files, feature, commit, PR)"
---

# Review BudgetView

Review the requested scope in this repository.

Focus especially on:
- financial correctness (rounding, cents vs floats, totals)
- SQL safety and transaction safety
- destructive UX (delete/overwrite/import flows)
- Svelte 5 rune correctness and store reactivity
- Tauri security / config regressions
- accessibility and French UI consistency
- missing or weak tests

Output format:
1. Critical issues
2. Important issues
3. Nice-to-have improvements
4. Suggested tests

Be specific: cite files, code paths, and failure modes.
