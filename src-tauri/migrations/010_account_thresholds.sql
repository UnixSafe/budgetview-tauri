-- Account balance threshold alerts
ALTER TABLE accounts ADD COLUMN low_balance_threshold INTEGER DEFAULT NULL;
ALTER TABLE accounts ADD COLUMN low_balance_enabled INTEGER DEFAULT 0;

-- Transaction notes index for search performance
CREATE INDEX IF NOT EXISTS idx_transactions_label ON transactions(label);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_series ON transactions(series_id);
