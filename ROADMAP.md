# BudgetView Tauri — Roadmap

Comparaison exhaustive entre le code Java original (870 classes) et la version Tauri.

**Légende** : ✅ Fait | 🔧 Partiel | ❌ Manquant

---

## État actuel (ce qui est fait)

| Fonctionnalité | État | Notes |
|---|---|---|
| Dashboard (solde, résumé, dernières transactions) | ✅ | |
| Comptes CRUD | ✅ | checking, savings, credit_card, cash |
| Transactions CRUD + recherche par label | ✅ | |
| Import OFX/QIF/CSV | ✅ | Détection format, doublons, preview |
| Catégories budget (series) CRUD | ✅ | 6 budget areas |
| Budget mensuel (planifié par mois) | ✅ | |
| Vue budget planifié vs réalisé | ✅ | Barres de progression colorées |
| Graphiques d'analyse (4 types) | ✅ | Barres, camembert, lignes, prévision |
| Projets & objectifs épargne | ✅ | CRUD + items + progression |
| Auto-catégorisation | ✅ | 3 niveaux matching, seuil 3, apprentissage |
| Gestion des règles de catégorisation | ✅ | Page settings/rules |

---

## Fonctionnalités manquantes

### P1 — Priorité haute (fonctionnalités métier essentielles)

#### 1. ❌ Ventilation de transactions (Transaction Splitting)
**Java** : `SplitTransactionAction`, `SplitTransactionDialog`
- Découper une transaction en plusieurs lignes affectées à des séries différentes
- Ex : ticket Carrefour 80€ → 60€ courses + 20€ maison
- Table `transaction_splits` existe déjà dans le schéma
- **Impact** : fonctionnalité critique pour un budget précis

#### 2. ❌ Export des données (CSV, OFX)
**Java** : `OfxExporter`, `TsvExporter`
- Export CSV/TSV des transactions filtrées
- Export OFX pour compatibilité
- Sélection par période, compte, catégorie
- **Impact** : impossible de sortir ses données actuellement

#### 3. ❌ Sauvegarde & restauration
**Java** : `BackupService`, `RestoreFileAction`, `RestoreSnapshotAction`
- Backup complet de la base SQLite
- Restauration depuis fichier
- Protection par mot de passe
- **Impact** : risque de perte de données

#### 4. ❌ Sous-séries (sous-catégories) — UI
**Java** : `SubSeriesEditionPanel`
- Table `sub_series` existe, pas d'UI
- Créer/modifier/supprimer des sous-catégories
- Assigner des transactions à une sous-série
- **Impact** : granularité du budget (ex : Santé → Médecin, Pharmacie)

#### 5. ❌ Recherche avancée des transactions
**Java** : `TransactionFilterPanel`
- Filtrer par plage de montant
- Filtrer par plage de dates
- Filtrer par état (catégorisé/non catégorisé)
- Recherche combinée multi-critères
- **Impact** : retrouver une transaction précise est laborieux

#### 6. ❌ Détection des transactions récurrentes
**Java** : `SeriesRepeatPanel`, `FilteredRepeats`
- Analyser l'historique pour détecter les récurrences
- Suggérer la création de séries budget
- Table `recurring_transactions` existe, pas de logique
- **Impact** : aide à la planification du budget

#### 7. ❌ Report de budget (Carryover)
**Java** : `CarryOverAction`, `CarryOverComputer`
- Reporter le surplus/déficit d'un mois au suivant
- Options : automatique ou manuel
- **Impact** : les enveloppes budgétaires perdent leur excédent chaque mois

---

### P2 — Priorité moyenne (enrichissement fonctionnel)

#### 8. ❌ Groupes de séries
**Java** : `SeriesGroupMenu`, `CreateSeriesGroupDialog`
- Regrouper des séries liées (ex : "Auto" = Carburant + Assurance + Crédit)
- Vue agrégée du budget par groupe

#### 9. ❌ Suivi des positions de compte
**Java** : `DailyAccountPositionComputer`, `AccountPositionEditionDialog`
- Historique du solde quotidien
- Graphe d'évolution du solde par compte
- Correction manuelle de position

#### 10. ❌ Rapprochement bancaire (Réconciliation)
**Java** : `ReconciliationAnnotationColumn`
- Marquer les transactions comme rapprochées
- Vérification croisée avec les relevés bancaires

#### 11. ❌ Tags sur les transactions
- Tables `tags` et `transaction_tags` existent, pas d'UI
- Ajouter des tags libres aux transactions
- Filtrer/rechercher par tag

#### 12. ❌ Types de transactions
**Java** : `TransactionType` (14 types)
- Virement, chèque, retrait DAB, prélèvement, CB, etc.
- Détection automatique du type à l'import
- Filtrage par type

#### 13. ❌ Undo/Redo
**Java** : `UndoRedoService`
- Annuler/refaire les dernières actions
- Historique des modifications

#### 14. ❌ Impression / PDF
**Java** : `TransactionsReport`, `BudgetReport`
- Imprimer la liste des transactions
- Imprimer le budget mensuel
- Mise en page configurable

#### 15. ❌ Navigation temporelle avancée
**Java** : `TimeGraph`, `MonthGraph`, `YearGraph`
- Graphe de navigation par mois/année
- Sélection de période par clic sur le graphe
- Vue annuelle

#### 16. ❌ Prévision de séries
**Java** : `SeriesForecastPanel`
- Auto-forecast vs montant fixe
- Prévision basée sur l'historique
- Tendances par série

---

### P3 — Priorité basse (confort & avancé)

#### 17. ❌ Chiffrement des données
**Java** : `MD5PasswordBasedEncryptor`
- Mot de passe pour protéger la base
- Chiffrement au repos

#### 18. ❌ Préférences utilisateur
**Java** : `StorageDirPane`, `ColorsPane`, `ParametersPane`
- Choix du répertoire de stockage
- Thème de couleurs
- Paramètres divers

#### 19. ❌ Notifications & alertes
**Java** : `NotificationService`, `NotificationsDialog`
- Alertes budget dépassé
- Rappels de catégorisation
- Notifications dans l'interface

#### 20. ❌ Indicateur de santé des comptes (Weather)
**Java** : `AccountWeather`, `WeatherWidget`
- Indicateurs rouge/orange/vert
- Basé sur l'évolution du solde et le taux d'épargne

#### 21. ❌ Onboarding / Visite guidée
**Java** : `Signpost`, `PersistentSignpost`
- Parcours guidé pour les nouveaux utilisateurs
- Aide contextuelle

#### 22. ❌ Vérification d'intégrité des données
**Java** : `DataCheckingService`
- Validation des comptes, séries, transactions
- Rapport d'intégrité
- Correction automatique

#### 23. ❌ Toggle dark/light mode
- Le dark mode est en dur, pas de switch
- Préférence système ou toggle manuel

#### 24. ❌ Carte débit différé
**Java** : `DeferredCardEditionPanel`, `DeferredCardCategorizationPanel`
- Gestion des CB à débit différé
- Vue spéciale catégorisation

---

## Ordre d'implémentation suggéré

### Sprint 1 — Compléter le MVP
1. **Ventilation de transactions** (P1) — la table existe déjà
2. **Export CSV** (P1) — sortir ses données
3. **Sauvegarde/restauration** (P1) — sécuriser les données

### Sprint 2 — Budget avancé
4. **Sous-séries UI** (P1)
5. **Report de budget** (P1)
6. **Recherche avancée** (P1)

### Sprint 3 — Automatisation
7. **Détection récurrences** (P1)
8. **Groupes de séries** (P2)
9. **Types de transactions** (P2)

### Sprint 4 — Intégrité & Analyse
10. **Rapprochement bancaire** (P2)
11. **Tags** (P2)
12. **Navigation temporelle** (P2)

### Sprint 5 — Confort
13. **Undo/Redo** (P2)
14. **Positions de compte** (P2)
15. **Prévision de séries** (P2)

### Sprint 6 — Finalisation
16. **Impression/PDF** (P2)
17. **Préférences** (P3)
18. **Chiffrement** (P3)
19. **Notifications** (P3)
20. **Onboarding** (P3)
