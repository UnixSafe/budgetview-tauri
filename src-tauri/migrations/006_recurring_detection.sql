-- Add detection fields to recurring_transactions
-- The table already exists from migration 001, we extend it for auto-detection

-- Track which transactions matched this recurrence
ALTER TABLE recurring_transactions ADD COLUMN label_pattern TEXT;
ALTER TABLE recurring_transactions ADD COLUMN last_occurrence_date DATE;
ALTER TABLE recurring_transactions ADD COLUMN next_expected_date DATE;
ALTER TABLE recurring_transactions ADD COLUMN tolerance_days INTEGER DEFAULT 5;
ALTER TABLE recurring_transactions ADD COLUMN is_auto_detected BOOLEAN DEFAULT 0;

-- Link transactions to their detected recurrence
ALTER TABLE transactions ADD COLUMN recurring_id INTEGER REFERENCES recurring_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions(recurring_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_transactions(is_active);
