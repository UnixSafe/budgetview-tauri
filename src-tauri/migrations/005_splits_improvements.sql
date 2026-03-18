-- Ajouter sub_series_id aux splits pour supporter les sous-catégories
ALTER TABLE transaction_splits ADD COLUMN sub_series_id INTEGER REFERENCES sub_series(id);

-- Sauvegarder la catégorie originale avant ventilation (pour restauration au delete)
ALTER TABLE transactions ADD COLUMN pre_split_series_id INTEGER REFERENCES budget_series(id);
ALTER TABLE transactions ADD COLUMN pre_split_sub_series_id INTEGER REFERENCES sub_series(id);
