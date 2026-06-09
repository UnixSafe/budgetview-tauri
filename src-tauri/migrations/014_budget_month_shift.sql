-- Décalage de mois budgétaire (feature "shift" du BudgetView original)
-- budget_date = date de rattachement budgétaire ; NULL = utiliser la date réelle
ALTER TABLE transactions ADD COLUMN budget_date TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_budget_date ON transactions(budget_date);
