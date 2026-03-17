-- Enhance auto-categorization: multi-level matching with label normalization

-- Add is_auto_categorized flag to transactions
ALTER TABLE transactions ADD COLUMN is_auto_categorized BOOLEAN DEFAULT 0;

-- Drop old categorization_rules and recreate with enhanced schema
DROP TABLE IF EXISTS categorization_rules;

CREATE TABLE categorization_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label_exact TEXT NOT NULL,
    label_normalized TEXT NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    sign INTEGER NOT NULL CHECK(sign IN (-1, 1)),
    series_id INTEGER NOT NULL REFERENCES budget_series(id) ON DELETE CASCADE,
    sub_series_id INTEGER REFERENCES sub_series(id) ON DELETE SET NULL,
    match_count INTEGER DEFAULT 1,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(label_exact, account_id, sign)
);

CREATE INDEX IF NOT EXISTS idx_cat_rules_normalized ON categorization_rules(label_normalized, account_id, sign);
CREATE INDEX IF NOT EXISTS idx_cat_rules_exact ON categorization_rules(label_exact, account_id, sign);
