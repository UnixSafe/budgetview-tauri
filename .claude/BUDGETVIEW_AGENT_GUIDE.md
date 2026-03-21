# BudgetView Agent Guide

Mini couche inspirée de Everything Claude Code, adaptée à ce repo.

## Ce qu'on reprend

- **Commandes projet-spécifiques** au lieu de prompts flous
- **Quality gate explicite** avant de déclarer un travail terminé
- **Workflow plan -> implémentation -> vérification -> review**
- **Package manager fixé** sur npm pour éviter les dérives d'outillage

## Ce qu'on ne reprend PAS

- la grosse couche de hooks génériques
- la persistance mémoire/session globale du plugin
- les agents/skills multi-langages hors sujet
- les automatisations intrusives sur chaque edit

## Commandes locales utiles

- `plan-feature` → planifier avant de coder
- `implement-budgetview-task` → implémenter proprement une tâche
- `workflow-budgetview` → workflow complet de bout en bout
- `verify-budgetview` → lancer les vérifications techniques
- `quality-gate-budgetview` → verdict de fin de tâche
- `review-budgetview` → review sécurité/finance/UI
- `fix-build-budgetview` → remettre le repo au vert

## Reviewers spécialisés

- `budgetview-frontend-reviewer` → Svelte 5 / SvelteKit / UX / accessibilité / français
- `budgetview-rust-reviewer` → Rust / Tauri / SQLite / migrations / sécurité
- `budgetview-finance-reviewer` → logique métier budget, imports, catégorisation, confiance utilisateur

## Philosophie

BudgetView n'a pas besoin d'un framework d'agents de 50 000 étoiles.
Il a besoin d'un Claude Code plus discipliné, plus spécifique au domaine finance,
et moins susceptible de partir en freestyle.
