# BudgetView Tauri - Roadmap

Etat verifie localement le 2 juin 2026.

Cette roadmap remplace l'ancien audit qui marquait encore comme manquantes plusieurs fonctionnalites deja presentes dans le depot. Elle distingue l'implementation disponible, les zones partielles et les chantiers restants pour arriver a une version publiable.

## Etat actuel

| Domaine | Etat | Notes |
|---|---|---|
| Dashboard | Fait | Solde, resume mensuel, sante budget, tresorerie et dernieres transactions. |
| Comptes | Fait | CRUD, types de comptes, seuils de solde bas et correction de solde. |
| Transactions | Fait | CRUD, recherche, filtres, categorisation manuelle, batch actions, rapprochement. |
| Import | Fait | OFX, QIF, CSV, preview, detection colonnes CSV, doublons et rollback par batch. |
| Budget | Fait | Series, sous-series, budgets mensuels, groupes de series, report manuel. |
| Analyse | Fait | Graphiques annuels, repartition, top depenses, prevision simple. |
| Projets | Fait | CRUD projets, items, progression et rattachement aux comptes/categories. |
| Auto-categorisation | Fait | Regles apprises, normalisation, exclusions, badge auto, dictionnaire mots-cles. |
| Ventilation | Fait | Splits de transaction avec controle du total et UI modale. |
| Recurrences | Fait | Detection, confirmation, CRUD, alertes de recurrence manquante. |
| Export | Partiel | CSV transactions et budget. OFX/PDF non livres. |
| Sauvegarde | Partiel | Backup/restore SQLite disponible. Il manque une strategie de sauvegarde automatique et tests d'integration. |
| Securite | Partiel | Mot de passe au lancement et hachage PBKDF2. Pas de chiffrement complet de la base au repos. |
| Preferences | Partiel | Format date, horizon previsionnel, mois budgetaire. Pas encore de vrai toggle theme. |
| IA | Optionnel | Categorisation via OpenRouter/xAI, avec cle stockee localement. Depend d'un appel reseau explicite. |
| Tests | Partiel | Tests frontend et backend existants. Les commandes Tauri et migrations doivent etre davantage couvertes. |

## Validations locales recentes

- `npm run check` : passe, avec des warnings a11y sur `master` tant que la PR accessibilite n'est pas mergee.
- `npm run build` : passe.
- `npx vitest run` : passe sur `master`.
- `cargo test` : passe.
- Une PR dediee ajoute `npm run test`, `npm run test:coverage` et des seuils de couverture frontend.

## Reste a faire

### P0 - Stabilisation release

1. **Merger les PRs de qualite deja ouvertes**
   - Couverture frontend stores et configuration coverage.
   - Corrections des warnings accessibilite Svelte.

2. **Tester le lancement reel Tauri**
   - Lancer `cargo tauri dev`.
   - Verifier creation DB, migrations, preload SQL, CSP, navigation et ouverture des dialogues fichiers.
   - Ajouter une checklist de smoke test documentee.

3. **Nettoyer le depot**
   - Supprimer les fichiers parasites non suivis (`.DS_Store`, temporaires agents).
   - Garder `node_modules/`, `build/`, `coverage/`, `.svelte-kit/`, `src-tauri/target/` ignores.
   - Decider si `AGENTS.md` et `dataset.md` doivent etre versionnes.

4. **Renforcer les tests Rust critiques**
   - Migrations SQLite.
   - `import_confirm`, rollback, splits, recurrences, backup/restore, exports CSV.
   - Edge cases : montants nuls/negatifs, ids inexistants, labels vides, fichiers invalides.

### P1 - Donnees et securite

5. **Chiffrement au repos**
   - Definir l'approche : SQLCipher, base chiffree externe, ou coffre applicatif local.
   - Ne pas presenter le mot de passe actuel comme un chiffrement complet.

6. **Sauvegarde automatique**
   - Snapshots locaux horodates.
   - Rotation configurable.
   - Restauration avec verification de schema et sauvegarde de securite.

7. **Verification d'integrite**
   - Controle des references orphelines.
   - Verification splits = montant transaction.
   - Rapport de donnees incoherentes et corrections proposees.

### P2 - Fonctionnel avance

8. **Tags de transactions**
   - Tables deja presentes.
   - Ajouter UI d'edition, affichage et filtres.

9. **Types de transactions**
   - CB, cheque, virement, prelevement, retrait, depot, frais, remboursement.
   - Detection a l'import et filtres dedies.

10. **Carte a debit differe**
    - Modeliser compte carte, date de debit et liaison avec compte bancaire.
    - Adapter categorisation et prevision.

11. **Export OFX et PDF**
    - OFX pour compatibilite.
    - PDF/print pour budget mensuel et transactions filtrees.

12. **Previsions plus proches du Java**
    - Integrer series recurrentes, jours du mois, reports, projets et historique.
    - Distinguer prevision automatique et montant fixe.

### P3 - Ergonomie

13. **Navigation temporelle avancee**
    - Vue mois/annee.
    - Selection de periode par graphe.
    - Comparaison multi-mois plus directe.

14. **Theme clair/sombre**
    - Toggle manuel.
    - Preference systeme.
    - Persistance dans `app_settings`.

15. **Notifications internes**
    - Budget depasse.
    - Solde bas.
    - Transactions non categorisees.
    - Recurrences manquantes.

16. **Onboarding final**
    - Parcours premier lancement.
    - Import de demo optionnel.
    - Checklist utilisateur : compte, import, budget, categorisation.

## Ordre de PR recommande

1. `test: expand frontend store coverage`
2. `fix: resolve modal accessibility warnings`
3. `docs: refresh project roadmap`
4. `test: add backend command and migration coverage`
5. `fix: harden backup restore workflow`
6. `feat: add transaction tags UI`
7. `feat: add transaction type detection`
8. `feat: add automatic backups`
9. `feat: add data integrity checks`
10. `feat: implement at-rest encryption`

## Definition de "pret pour release"

- `cargo tauri dev` demarre sans erreur sur une base neuve.
- `npm run check`, `npm run build`, `npm run test` et `cargo test` passent.
- Import OFX/QIF/CSV teste avec fixtures.
- Backup/restore teste sur une base non vide.
- Aucune donnee financiere stockee en `REAL`.
- CSP active.
- Aucun fichier genere ou log agent versionne.
- Les limitations de securite sont documentees clairement.
