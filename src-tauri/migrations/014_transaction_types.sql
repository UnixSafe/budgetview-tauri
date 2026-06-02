-- Transaction type classification
ALTER TABLE transactions ADD COLUMN transaction_type TEXT DEFAULT 'other'
    CHECK(transaction_type IN (
        'card',
        'transfer',
        'direct_debit',
        'check',
        'cash_withdrawal',
        'cash_deposit',
        'fee',
        'refund',
        'income',
        'other'
    ));

UPDATE transactions
SET transaction_type = CASE
    WHEN LOWER(label) LIKE '%cheque%' OR LOWER(label) LIKE '%chèque%' OR LOWER(label) LIKE '%chq%' THEN 'check'
    WHEN LOWER(label) LIKE '%retrait%' OR LOWER(label) LIKE '%dab%' OR LOWER(label) LIKE '%gab%' THEN 'cash_withdrawal'
    WHEN LOWER(label) LIKE '%depot esp%' OR LOWER(label) LIKE '%dépôt esp%' OR LOWER(label) LIKE '%remise esp%' OR LOWER(label) LIKE '%versement esp%' THEN 'cash_deposit'
    WHEN LOWER(label) LIKE '%prlv%' OR LOWER(label) LIKE '%prelevement%' OR LOWER(label) LIKE '%prélèvement%' THEN 'direct_debit'
    WHEN LOWER(label) LIKE '%vir%' OR LOWER(label) LIKE '%virement%' OR LOWER(label) LIKE '%transfert%' THEN 'transfer'
    WHEN LOWER(label) LIKE '%cb%' OR LOWER(label) LIKE '%carte%' THEN 'card'
    WHEN LOWER(label) LIKE '%frais%' OR LOWER(label) LIKE '%commission%' THEN 'fee'
    WHEN LOWER(label) LIKE '%remb%' OR LOWER(label) LIKE '%refund%' THEN 'refund'
    WHEN amount > 0 THEN 'income'
    ELSE 'other'
END
WHERE transaction_type IS NULL OR transaction_type = 'other';

CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
