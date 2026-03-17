PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Comptes bancaires
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account_number TEXT,
    bank_name TEXT,
    account_type TEXT CHECK(account_type IN ('checking', 'savings', 'credit_card', 'cash')) DEFAULT 'checking',
    currency TEXT DEFAULT 'EUR',
    initial_balance REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Catégories de budget (Series)
CREATE TABLE IF NOT EXISTS budget_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    budget_area TEXT CHECK(budget_area IN ('income', 'recurring', 'variable', 'extras', 'savings', 'transfers')),
    target_amount REAL,
    day_of_month INTEGER,
    is_active BOOLEAN DEFAULT 1,
    description TEXT
);

-- Sous-catégories
CREATE TABLE IF NOT EXISTS sub_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL REFERENCES budget_series(id) ON DELETE CASCADE,
    name TEXT NOT NULL
);

-- Batches d'import pour pouvoir rollback
CREATE TABLE IF NOT EXISTS import_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    format TEXT CHECK(format IN ('ofx', 'qif', 'csv')),
    account_id INTEGER REFERENCES accounts(id),
    transaction_count INTEGER DEFAULT 0,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    label TEXT NOT NULL,
    original_label TEXT,
    amount REAL NOT NULL,
    note TEXT,
    is_planned BOOLEAN DEFAULT 0,
    series_id INTEGER REFERENCES budget_series(id) ON DELETE SET NULL,
    sub_series_id INTEGER REFERENCES sub_series(id) ON DELETE SET NULL,
    import_batch_id INTEGER REFERENCES import_batches(id),
    fitid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions splittées (une transaction → plusieurs catégories)
CREATE TABLE IF NOT EXISTS transaction_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    amount REAL NOT NULL,
    note TEXT
);

-- Budget mensuel par série
CREATE TABLE IF NOT EXISTS monthly_budget (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL REFERENCES budget_series(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    planned_amount REAL NOT NULL,
    UNIQUE(series_id, year, month)
);

-- Templates de transactions récurrentes
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

-- Projets / Objectifs
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_amount REAL,
    target_date DATE,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT 1
);

-- Items de projet
CREATE TABLE IF NOT EXISTS project_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    planned_amount REAL NOT NULL,
    month INTEGER,
    year INTEGER,
    series_id INTEGER REFERENCES budget_series(id) ON DELETE SET NULL
);

-- Tags transversaux
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS transaction_tags (
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
);

-- Règles de catégorisation auto
CREATE TABLE IF NOT EXISTS categorization_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL UNIQUE,
    series_id INTEGER NOT NULL REFERENCES budget_series(id),
    sub_series_id INTEGER REFERENCES sub_series(id),
    match_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_series ON transactions(series_id);
CREATE INDEX IF NOT EXISTS idx_transactions_fitid ON transactions(fitid);
CREATE INDEX IF NOT EXISTS idx_monthly_budget_period ON monthly_budget(year, month);
CREATE INDEX IF NOT EXISTS idx_project_items_project ON project_items(project_id);
