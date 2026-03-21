---
description: "Workflow complet BudgetView: scope, plan, implémentation, vérification, review"
argument-hint: "tâche à réaliser"
---

# Workflow BudgetView

Tu es en mode exécution disciplinée pour **BudgetView Tauri**.

## Objectif
Traiter une tâche de bout en bout sans partir en freestyle.

## Phase 1 — Scope
1. Reformule la demande en 1 à 3 phrases.
2. Liste les zones impactées du repo.
3. Signale immédiatement les inconnues ou risques.
4. Lis les fichiers pertinents avant toute modif.

## Phase 2 — Plan
1. Écris un plan concret en petites étapes.
2. Mentionne explicitement :
   - impacts frontend
   - impacts Rust/backend
   - impacts DB/migrations
   - impacts métier finance
   - tests à adapter
3. Ne commence pas par un gros refactor si une petite modif suffit.

## Phase 3 — Implémentation
1. Implémente par petites étapes cohérentes.
2. Garde l'UI en français.
3. Préserve l'offline-first.
4. Utilise des migrations si le schéma change.
5. Ajoute/ajuste des tests quand le comportement change.

## Phase 4 — Vérification technique
Lance selon le scope :
- `npm run build`
- `npx vitest run`
- `cargo test`
- `cargo check`

Si un check échoue :
- trouve la vraie cause racine
- corrige proprement
- relance le minimum nécessaire, puis le gate final

## Phase 5 — Triple review spécialisée
Passe mentalement ou explicitement par trois reviewers :
- `budgetview-frontend-reviewer`
- `budgetview-rust-reviewer`
- `budgetview-finance-reviewer`

Pour chacun, cherche les risques spécifiques plutôt que de faire une review générique.

## Phase 6 — Sortie finale
Réponds avec :
1. Résumé de ce qui a été fait
2. Fichiers changés
3. Vérifications exécutées et résultats
4. Risques restants
5. Prochaine petite étape logique

## Règles
- Pas de victoire déclarée sans vérification réelle.
- Pas de gros ménage hors-scope.
- Pas d'impro sur les chiffres financiers.
- Si blocage, explique-le clairement au lieu de contourner salement.
