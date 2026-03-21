---
description: "Run the BudgetView verification gate"
---

# Verify BudgetView

Run a full verification pass for this repo.

Checklist:
1. Frontend build: `npm run build`
2. Frontend tests: `npx vitest run`
3. Rust tests: `cargo test`
4. Rust compile check: `cargo check`

Then report:
- what passed
- what failed
- exact failing file/module
- smallest safe next fix

Rules:
- Do not claim success unless all required checks actually passed.
- If one command fails, inspect the error before changing code.
- Prefer minimal fixes over broad refactors.
- Keep the report concise and factual.
