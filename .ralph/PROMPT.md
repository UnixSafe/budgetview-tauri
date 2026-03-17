# BudgetView Tauri — Réécriture complète

## Contexte

Réécriture de **BudgetView** (logiciel Java Swing de gestion de budget personnel) en **Tauri 2 + Svelte 5 + SQLite**. Le code source Java original est dans `/home/jeremy/Documents/budgetview-source/` pour référence.

## Stack

- **Frontend** : Svelte 5 (runes `$state`/`$derived`), SvelteKit static adapter
- **Styling** : TailwindCSS 4
- **Backend** : Rust (Tauri 2) avec `tauri-plugin-sql` (SQLite)
- **Charts** : Layercake (Svelte-native) ou Chart.js
- **Icons** : Lucide Svelte
- **Build** : Vite

## Tâches ordonnées

### Phase 1 — Fondations (faire EN PREMIER)

- [ ] Initialiser le projet Tauri 2 + Svelte 5 + TailwindCSS 4
- [ ] Créer le schéma SQLite complet avec migrations (voir modèle ci-dessous)
- [ ] Implémenter les commandes Tauri Rust : init DB, CRUD comptes, CRUD transactions
- [ ] Import OFX/QIF/CSV (parser en Rust — utiliser `ofx-parser` crate si dispo)
- [ ] Détection de doublons à l'import (FITID + fuzzy matching montant/date/label)
- [ ] Layout principal : sidebar navigation + pages
- [ ] Liste transactions : tri, recherche, filtre par compte/catégorie/date
- [ ] Catégorisation manuelle des transactions (affecter une série budget)
- [ ] Catégorisation intelligente : après 2-3 catégorisations manuelles d'un même libellé, suggérer automatiquement
- [ ] CRUD catégories budget (séries) avec budget areas
- [ ] Budget mensuel : montant planifié par catégorie/mois
- [ ] Vue budget : barres de progression planifié vs réalisé

### Phase 2 — Analyse & Intelligence

- [ ] Dashboard "où en suis-je" : solde, reste à dépenser, prochaines récurrences
- [ ] Transactions splittées (une transaction → plusieurs catégories)
- [ ] Transactions récurrentes : templates + auto-création
- [ ] Graphiques : évolution dépenses, camembert par catégorie, tendances
- [ ] Trésorerie prévisionnelle sur les mois à venir
- [ ] Recherche globale Ctrl+K (transactions, comptes, catégories)

### Phase 3 — Avancé

- [ ] Projets / objectifs d'épargne avec suivi
- [ ] Multi-comptes : vues consolidées, transferts inter-comptes
- [ ] Import du format BudgetView Java (migration utilisateurs existants)
- [ ] Export PDF / CSV
- [ ] Chiffrement des données (mot de passe)
- [ ] Undo/Redo robuste (historique d'actions)
- [ ] Rapprochement bancaire

## Modèle de données SQLite

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    account_number TEXT,
    bank_name TEXT,
    account_type TEXT CHECK(account_type IN ('checking', 'savings', 'credit_card', 'cash')),
    currency TEXT DEFAULT 'EUR',
    initial_balance REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE budget_series (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    budget_area TEXT CHECK(budget_area IN ('income', 'recurring', 'variable', 'extras', 'savings', 'transfers')),
    target_amount REAL,
    day_of_month INTEGER,
    is_active BOOLEAN DEFAULT 1,
    description TEXT
);

CREATE TABLE sub_series (
    id INTEGER PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES budget_series(id) ON DELETE CASCADE,
    name TEXT NOT NULL
);

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
    import_batch_id INTEGER REFERENCES import_batches(id),
    fitid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions splittées (une transaction, plusieurs catégories)
CREATE TABLE transaction_splits (
    id INTEGER PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    amount REAL NOT NULL,
    note TEXT
);

CREATE TABLE monthly_budget (
    id INTEGER PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    planned_amount REAL NOT NULL,
    UNIQUE(series_id, year, month)
);

-- Templates de transactions récurrentes
CREATE TABLE recurring_transactions (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    label TEXT NOT NULL,
    amount REAL NOT NULL,
    series_id INTEGER REFERENCES budget_series(id),
    frequency TEXT CHECK(frequency IN ('monthly', 'weekly', 'biweekly', 'quarterly', 'yearly')),
    day_of_month INTEGER,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT 1
);

CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount REAL,
    target_date DATE,
    account_id INTEGER REFERENCES accounts(id),
    is_active BOOLEAN DEFAULT 1
);

CREATE TABLE project_items (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    planned_amount REAL NOT NULL,
    month INTEGER,
    year INTEGER,
    series_id INTEGER REFERENCES budget_series(id)
);

-- Batches d'import pour pouvoir rollback
CREATE TABLE import_batches (
    id INTEGER PRIMARY KEY,
    filename TEXT NOT NULL,
    format TEXT CHECK(format IN ('ofx', 'qif', 'csv')),
    account_id INTEGER REFERENCES accounts(id),
    transaction_count INTEGER DEFAULT 0,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags transversaux (many-to-many)
CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE transaction_tags (
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
);

-- Règles de catégorisation auto
CREATE TABLE categorization_rules (
    id INTEGER PRIMARY KEY,
    pattern TEXT NOT NULL,
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    sub_series_id INTEGER REFERENCES sub_series(id),
    match_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour la performance
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_series ON transactions(series_id);
CREATE INDEX idx_transactions_fitid ON transactions(fitid);
CREATE INDEX idx_monthly_budget_period ON monthly_budget(year, month);
```

## Règles de dev

1. **Tout en français** (interface, labels, messages)
2. **Offline-first** — zéro cloud, tout local
3. **Dark mode** par défaut, light mode disponible
4. **Keyboard-first** — raccourcis clavier partout
5. **Pas de setup wizard** — import OFX = onboarding, comptes créés auto
6. **TypeScript strict** côté frontend
7. **Performance** : batche les queries Rust, retourne du JSON agrégé via IPC (pas 500 appels individuels)
8. **WAL mode** SQLite activé dès le départ
9. **Git commit** à chaque étape fonctionnelle avec message clair

## Référence Java

- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/` — UI
- `budgetview-source/budgetview/bv_shared/src/main/java/com/budgetview/shared/` — modèles
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/budget/` — logique budget
- `budgetview-source/budgetview/bv_desktop/src/main/java/com/budgetview/desktop/transactions/` — transactions
