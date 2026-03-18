-- Simplify auto-categorization: single anonymized label pattern per rule
-- Add label_for_categorization to transactions for quick lookup

ALTER TABLE transactions ADD COLUMN label_for_categorization TEXT;

-- Drop old complex categorization_rules and recreate with simple schema
DROP TABLE IF EXISTS categorization_rules;

CREATE TABLE categorization_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label_pattern TEXT NOT NULL UNIQUE,
    series_id INTEGER NOT NULL REFERENCES budget_series(id) ON DELETE CASCADE,
    sub_series_id INTEGER REFERENCES sub_series(id) ON DELETE SET NULL,
    match_count INTEGER DEFAULT 1,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cat_rules_pattern ON categorization_rules(label_pattern);

-- Backfill label_for_categorization for existing transactions with a rough UPPER value.
-- The app refines this with proper anonymization (stripping dates/digit sequences) on startup.
UPDATE transactions SET label_for_categorization = UPPER(COALESCE(original_label, label))
WHERE label_for_categorization IS NULL;
