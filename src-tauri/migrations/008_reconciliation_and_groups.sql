-- Transaction reconciliation
ALTER TABLE transactions ADD COLUMN is_reconciled BOOLEAN DEFAULT 0;

-- Series groups (group related budget categories)
CREATE TABLE IF NOT EXISTS series_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_expanded BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0
);

ALTER TABLE budget_series ADD COLUMN group_id INTEGER REFERENCES series_groups(id) ON DELETE SET NULL;

-- Budget carry-over tracking
CREATE TABLE IF NOT EXISTS budget_carry_over (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL REFERENCES budget_series(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    carry_amount INTEGER NOT NULL DEFAULT 0,
    UNIQUE(series_id, year, month)
);
