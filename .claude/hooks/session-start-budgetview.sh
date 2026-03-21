#!/usr/bin/env bash
set -euo pipefail

# Hook léger BudgetView: injecte un mini contexte projet au démarrage
# sans logique lourde ni side effects.

cat <<'EOF'
[BudgetView Agent Context]
Projet: BudgetView Tauri
Guide local: .claude/BUDGETVIEW_AGENT_GUIDE.md

Commandes projet utiles:
- plan-feature
- implement-budgetview-task
- workflow-budgetview
- verify-budgetview
- quality-gate-budgetview
- review-budgetview
- fix-build-budgetview

Reviewers spécialisés:
- budgetview-frontend-reviewer
- budgetview-rust-reviewer
- budgetview-finance-reviewer

Rappels:
- interface en français
- attention aux montants, soldes, imports et catégorisation
- préférer petites modifs + vérifications réelles
- ne pas déclarer terminé sans build/tests/check pertinents
EOF
