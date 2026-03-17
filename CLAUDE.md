# BudgetView Tauri — Projet de réécriture

## Contexte

On refait **BudgetView** (https://budgetview.fr) — un logiciel de gestion de budget personnel — en **Tauri 2 + Svelte 5 + SQLite**.

Le code source Java original est dans `/home/jeremy/Documents/budgetview-source/` (3266 fichiers Java). C'est ta référence pour comprendre la logique métier, les modèles de données, et les fonctionnalités.

## Stack technique

- **Frontend** : Svelte 5 (runes, mode `$state`/`$derived`), SvelteKit (static adapter)
- **Styling** : TailwindCSS 4
- **Backend** : Rust (Tauri 2)
- **Base de données** : SQLite via `tauri-plugin-sql`
- **Charts** : Chart.js ou Layercake (Svelte-native)
- **Icons** : Lucide Svelte
- **Build** : Vite + Tauri CLI

## Architecture

```
budgetview-tauri/
├── src/                    # Frontend Svelte
│   ├── lib/
│   │   ├── components/     # Composants UI réutilisables
│   │   ├── stores/         # State management Svelte
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Helpers (formatage, calculs)
│   └── routes/             # Pages SvelteKit
│       ├── +layout.svelte  # Layout principal avec sidebar
│       ├── dashboard/      # Vue d'ensemble budget
│       ├── accounts/       # Gestion des comptes
│       ├── transactions/   # Liste & catégorisation
│       ├── budget/         # Planification budget par catégorie
│       ├── analysis/       # Graphiques & analyse
│       └── projects/       # Projets & objectifs épargne
├── src-tauri/              # Backend Rust
│   ├── src/
│   │   ├── main.rs
│   │   ├── db.rs           # Migrations & queries SQLite
│   │   ├── commands.rs     # Commandes Tauri (IPC)
│   │   ├── import.rs       # Import OFX/QIF/CSV
│   │   └── export.rs       # Export données
│   └── Cargo.toml
├── CLAUDE.md               # Ce fichier
└── package.json
```

## Modèle de données (basé sur le Java original)

### Tables principales

```sql
-- Comptes bancaires
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    account_number TEXT,
    bank_name TEXT,
    account_type TEXT CHECK(account_type IN ('checking', 'savings', 'credit_card', 'cash')),
    initial_balance REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    date DATE NOT NULL,
    label TEXT NOT NULL,
    original_label TEXT,
    amount REAL NOT NULL,
    note TEXT,
    is_planned BOOLEAN DEFAULT 0,
    series_id INTEGER REFERENCES budget_series(id),
    sub_series_id INTEGER REFERENCES sub_series(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Catégories de budget (comme les "Series" dans BudgetView)
CREATE TABLE budget_series (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    budget_area TEXT CHECK(budget_area IN ('income', 'recurring', 'variable', 'extras', 'savings', 'transfers')),
    target_amount REAL,
    day_of_month INTEGER,
    is_active BOOLEAN DEFAULT 1,
    profile_type TEXT DEFAULT 'IRREGULAR',
    description TEXT
);

-- Sous-catégories
CREATE TABLE sub_series (
    id INTEGER PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    name TEXT NOT NULL
);

-- Budget mensuel par série
CREATE TABLE monthly_budget (
    id INTEGER PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    planned_amount REAL NOT NULL,
    UNIQUE(series_id, year, month)
);

-- Projets / Objectifs
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount REAL,
    target_date DATE,
    account_id INTEGER REFERENCES accounts(id),
    image_path TEXT,
    is_active BOOLEAN DEFAULT 1
);

-- Items de projet (dépenses prévues dans un projet)
CREATE TABLE project_items (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    label TEXT NOT NULL,
    planned_amount REAL NOT NULL,
    month INTEGER,
    year INTEGER,
    series_id INTEGER REFERENCES budget_series(id)
);
```

## Fonctionnalités (par priorité)

### Phase 1 — MVP (faire ça EN PREMIER)
1. **Dashboard** : solde actuel, graphe trésorerie, résumé budget du mois
2. **Comptes** : CRUD comptes bancaires
3. **Transactions** : liste, tri, recherche, catégorisation manuelle
4. **Import** : fichiers OFX, QIF, CSV (formats bancaires français)
5. **Catégories budget** : créer des séries (loyer, courses, salaire...)
6. **Budget mensuel** : définir un montant planifié par catégorie/mois
7. **Vue budget** : comparaison planifié vs réalisé avec barres de progression

### Phase 2 — Analyse
8. **Graphiques** : évolution des dépenses, camembert par catégorie
9. **Trésorerie prévisionnelle** : projection sur les mois à venir
10. **Récurrence auto** : détecter les transactions récurrentes

### Phase 3 — Avancé
11. **Projets** : planifier des objectifs d'épargne
12. **Multi-comptes** : vues consolidées
13. **Export** : PDF, CSV
14. **Chiffrement** : mot de passe pour protéger les données

## Règles de développement

1. **Français** : toute l'interface en français
2. **Offline-first** : aucune dépendance cloud, tout local
3. **Design moderne** : UI clean, dark mode, animations subtiles
4. **Performance** : SQLite natif via Tauri, pas d'ORM JS lourd
5. **Type-safe** : TypeScript strict côté frontend, Rust côté backend
6. **Responsive** : fonctionne bien en plein écran et en fenêtre réduite
7. **Accessibilité** : labels, contraste, navigation clavier

## Référence Java

Pour comprendre la logique métier, consulte :
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/` — UI & logique desktop
- `budgetview-source/budgetview/bv_shared/src/main/java/com/budgetview/shared/` — modèles partagés
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/model/` — modèles de données
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/budget/` — logique budget
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/transactions/` — transactions
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/analysis/` — analyse & graphiques

## Comment procéder

1. Commence par initialiser le projet Tauri 2 + Svelte 5 + TailwindCSS
2. Crée le schéma SQLite et les migrations
3. Implémente les commandes Tauri (CRUD comptes, transactions, budget)
4. Construis l'UI page par page en commençant par le dashboard
5. Teste chaque fonctionnalité avant de passer à la suivante
6. Fais des commits Git réguliers avec des messages clairs

## Notes

- Le projet original utilise un framework custom "globsFramework" — on n'en a pas besoin, SQLite + Svelte stores suffisent
- Les "Series" dans BudgetView = nos "budget_series" (catégories de budget)
- Les "BudgetArea" = income/recurring/variable/extras/savings/transfers
- L'import OFX est critique car c'est le format standard des banques françaises
