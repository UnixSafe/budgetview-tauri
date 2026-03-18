-- Ajouter created_at à transaction_splits pour traçabilité
ALTER TABLE transaction_splits ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
