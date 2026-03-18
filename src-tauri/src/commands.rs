use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tauri::command;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::import::{
    self, CsvConfig, ImportPreview, ImportResult, RawTransaction,
};

/// Categorization rule loaded from the database (simplified schema)
#[derive(Debug, Clone)]
struct CatRule {
    label_pattern: String,
    series_id: i64,
    sub_series_id: Option<i64>,
}

/// Input for creating a single split line
#[derive(Debug, Deserialize)]
pub struct SplitInput {
    pub amount_cents: i64,
    pub series_id: i64,
    pub sub_series_id: Option<i64>,
    pub note: Option<String>,
}

/// A split line returned from the database
#[derive(Debug, Serialize)]
pub struct Split {
    pub id: i64,
    pub transaction_id: i64,
    pub series_id: i64,
    pub sub_series_id: Option<i64>,
    pub amount: i64,
    pub note: Option<String>,
    pub created_at: Option<String>,
    pub series_name: Option<String>,
    pub sub_series_name: Option<String>,
}

/// Cache for parsed import data to avoid double-parsing between preview and confirm
pub struct ImportCache(pub Mutex<HashMap<String, Vec<RawTransaction>>>);

#[command]
pub fn greet(name: &str) -> String {
    format!("Bienvenue dans BudgetView, {} !", name)
}

/// Parse a file and return a preview of transactions to import
#[command]
pub async fn import_preview(
    file_path: String,
    csv_config: Option<CsvConfig>,
    db: tauri::State<'_, DbInstances>,
    cache: tauri::State<'_, ImportCache>,
) -> Result<ImportPreview, String> {
    // Read file with encoding detection
    let content = import::read_file_with_encoding(&file_path)?;
    let format = import::detect_format(&content);

    let (transactions, account_number, bank_id) = match format {
        "ofx" => import::parse_ofx(&content)?,
        "qif" => {
            let txs = import::parse_qif(&content)?;
            (txs, None, None)
        }
        "csv" => {
            let config = csv_config.unwrap_or_else(|| import::detect_csv_config(&content));
            let txs = import::parse_csv(&content, &config)?;
            (txs, None, None)
        }
        _ => return Err("Format de fichier non reconnu".to_string()),
    };

    // Get existing transactions for dedup
    let pool = get_db_pool(&db).await?;
    let (existing_fitids, existing_hashes) = get_existing_transaction_data(&pool).await?;

    let duplicates = import::find_duplicate_indices(&transactions, &existing_fitids, &existing_hashes);
    let total_count = transactions.len();
    let new_count = total_count - duplicates.len();

    // Cache parsed transactions for confirm step
    cache.0.lock().map_err(|e| format!("Erreur cache: {}", e))?
        .insert(file_path.clone(), transactions.clone());

    Ok(ImportPreview {
        format: format.to_string(),
        account_number,
        bank_id,
        transactions,
        duplicates,
        total_count,
        new_count,
    })
}

/// Detect CSV configuration from file content
#[command]
pub async fn detect_csv_columns(file_path: String) -> Result<CsvColumnInfo, String> {
    let content = import::read_file_with_encoding(&file_path)?;
    let config = import::detect_csv_config(&content);

    // Get header names
    let first_line = content.lines().next().unwrap_or("");
    let headers: Vec<String> = first_line
        .split(config.delimiter)
        .map(|s| s.trim().trim_matches('"').to_string())
        .collect();

    // Get sample data (first 3 rows)
    let mut sample_rows: Vec<Vec<String>> = Vec::new();
    for line in content.lines().skip(1).take(3) {
        let row: Vec<String> = line
            .split(config.delimiter)
            .map(|s| s.trim().trim_matches('"').to_string())
            .collect();
        sample_rows.push(row);
    }

    Ok(CsvColumnInfo {
        headers,
        sample_rows,
        detected_config: config,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvColumnInfo {
    pub headers: Vec<String>,
    pub sample_rows: Vec<Vec<String>>,
    pub detected_config: CsvConfig,
}

/// Confirm and execute the import
#[command]
pub async fn import_confirm(
    file_path: String,
    account_id: i64,
    csv_config: Option<CsvConfig>,
    skip_indices: Vec<usize>,
    db: tauri::State<'_, DbInstances>,
    cache: tauri::State<'_, ImportCache>,
) -> Result<ImportResult, String> {
    let filename = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("import")
        .to_string();

    // Use cached transactions from preview, or re-parse as fallback
    let transactions = {
        let mut cache_map = cache.0.lock().map_err(|e| format!("Erreur cache: {}", e))?;
        match cache_map.remove(&file_path) {
            Some(txs) => txs,
            None => {
                // Fallback: re-parse if cache was cleared
                let content = import::read_file_with_encoding(&file_path)?;
                let format = import::detect_format(&content);
                let (txs, _, _) = match format {
                    "ofx" => import::parse_ofx(&content)?,
                    "qif" => {
                        let parsed = import::parse_qif(&content)?;
                        (parsed, None, None)
                    }
                    "csv" => {
                        let config = csv_config.unwrap_or_else(|| import::detect_csv_config(&content));
                        let parsed = import::parse_csv(&content, &config)?;
                        (parsed, None, None)
                    }
                    _ => return Err("Format non reconnu".to_string()),
                };
                txs
            }
        }
    };

    // Detect format for batch record
    let content = import::read_file_with_encoding(&file_path)?;
    let format = import::detect_format(&content);

    let pool = get_db_pool(&db).await?;

    // Get existing for dedup
    let (existing_fitids, existing_hashes) = get_existing_transaction_data(&pool).await?;
    let auto_dupes = import::find_duplicate_indices(&transactions, &existing_fitids, &existing_hashes);

    // Combine auto-detected duplicates with user-skipped indices
    let mut skip_set: std::collections::HashSet<usize> = skip_indices.into_iter().collect();
    for idx in &auto_dupes {
        skip_set.insert(*idx);
    }

    // Get categorization rules for auto-categorization
    let rule_rows: Vec<(String, i64, Option<i64>)> = sqlx::query_as(
        "SELECT label_pattern, series_id, sub_series_id
         FROM categorization_rules WHERE match_count >= 3 ORDER BY match_count DESC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur chargement règles: {}", e))?;

    let rules: Vec<CatRule> = rule_rows.into_iter().map(|r| CatRule {
        label_pattern: r.0,
        series_id: r.1,
        sub_series_id: r.2,
    }).collect();

    // Wrap all inserts in a transaction for atomicity
    let mut db_tx = pool.begin().await.map_err(|e| format!("Erreur début transaction: {}", e))?;

    // Create import batch
    let batch_result = sqlx::query(
        "INSERT INTO import_batches (filename, format, account_id, transaction_count) VALUES (?, ?, ?, ?)"
    )
    .bind(&filename)
    .bind(format)
    .bind(account_id)
    .bind(0i32)
    .execute(&mut *db_tx)
    .await
    .map_err(|e| format!("Erreur création batch: {}", e))?;

    let batch_id = batch_result.last_insert_rowid();

    // Insert transactions
    let mut imported_count = 0usize;
    let mut auto_categorized_count = 0usize;
    for (i, tx) in transactions.iter().enumerate() {
        if skip_set.contains(&i) {
            continue;
        }

        let amount_cents = (tx.amount * 100.0).round() as i64;
        let label_anon = anonymize_label(&tx.label);

        // Check if excluded from auto-categorization (checks, cash withdrawals/deposits)
        let excluded = is_excluded_from_auto_categorization(&tx.label);

        // Auto-categorize: find matching rule by anonymized label
        let (series_id, sub_series_id, is_auto) = if excluded || label_anon.is_empty() {
            (None, None, false)
        } else {
            match rules.iter().find(|r| r.label_pattern == label_anon) {
                Some(r) => (Some(r.series_id), r.sub_series_id, true),
                None => (None, None, false),
            }
        };

        if is_auto {
            auto_categorized_count += 1;
        }

        sqlx::query(
            "INSERT INTO transactions (account_id, date, label, original_label, amount, note, fitid, import_batch_id, series_id, sub_series_id, is_auto_categorized, label_for_categorization)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(account_id)
        .bind(&tx.date)
        .bind(&tx.label)
        .bind(&tx.original_label)
        .bind(amount_cents)
        .bind(&tx.note)
        .bind(&tx.fitid)
        .bind(batch_id)
        .bind(series_id)
        .bind(sub_series_id)
        .bind(is_auto)
        .bind(&label_anon)
        .execute(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur insertion transaction: {}", e))?;

        imported_count += 1;
    }

    // Update batch count
    sqlx::query("UPDATE import_batches SET transaction_count = ? WHERE id = ?")
        .bind(imported_count as i32)
        .bind(batch_id)
        .execute(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur mise à jour batch: {}", e))?;

    db_tx.commit().await.map_err(|e| format!("Erreur commit transaction: {}", e))?;

    Ok(ImportResult {
        batch_id,
        imported_count,
        duplicates_skipped: skip_set.len(),
        account_id,
        auto_categorized_count,
    })
}

/// Backfill label_for_categorization for existing transactions using proper anonymization.
/// Called once on app startup to refine the rough UPPER() values set by migration 003.
#[command]
pub async fn backfill_categorization_labels(
    db: tauri::State<'_, DbInstances>,
) -> Result<usize, String> {
    let pool = get_db_pool(&db).await?;

    let rows: Vec<(i64, String, Option<String>)> = sqlx::query_as(
        "SELECT id, label, original_label FROM transactions WHERE label_for_categorization IS NULL
         OR label_for_categorization = UPPER(COALESCE(original_label, label))"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur lecture transactions: {}", e))?;

    if rows.is_empty() {
        return Ok(0);
    }

    let mut tx = pool.begin().await.map_err(|e| format!("Erreur début transaction: {}", e))?;

    for (id, label, original_label) in &rows {
        let source = original_label.as_deref().unwrap_or(label);
        let anon = anonymize_label(source);
        sqlx::query("UPDATE transactions SET label_for_categorization = ? WHERE id = ?")
            .bind(&anon)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Erreur mise à jour transaction {}: {}", id, e))?;
    }

    tx.commit().await.map_err(|e| format!("Erreur commit: {}", e))?;
    Ok(rows.len())
}

/// Rollback an import batch (delete all transactions and clean up learned rules)
#[command]
pub async fn import_rollback(
    batch_id: i64,
    db: tauri::State<'_, DbInstances>,
) -> Result<usize, String> {
    let pool = get_db_pool(&db).await?;

    // Count manually-categorized transactions per label pattern in this batch,
    // so we can decrement the corresponding rules' match_count.
    let label_counts: Vec<(String, i64)> = sqlx::query_as(
        "SELECT label_for_categorization, COUNT(*) FROM transactions
         WHERE import_batch_id = ? AND label_for_categorization IS NOT NULL
           AND series_id IS NOT NULL AND is_auto_categorized = 0
         GROUP BY label_for_categorization"
    )
    .bind(batch_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur lecture labels batch: {}", e))?;

    let result = sqlx::query("DELETE FROM transactions WHERE import_batch_id = ?")
        .bind(batch_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Erreur rollback: {}", e))?;

    let deleted = result.rows_affected() as usize;

    // Decrement match_count for rules learned from manually-categorized transactions in this batch
    for (label, count) in &label_counts {
        sqlx::query(
            "UPDATE categorization_rules SET match_count = match_count - ? WHERE label_pattern = ?"
        )
        .bind(count)
        .bind(label)
        .execute(&pool)
        .await
        .map_err(|e| format!("Erreur mise à jour règle: {}", e))?;
    }

    // Clean up rules that have dropped to zero or below
    sqlx::query("DELETE FROM categorization_rules WHERE match_count <= 0")
        .execute(&pool)
        .await
        .map_err(|e| format!("Erreur nettoyage règles: {}", e))?;

    sqlx::query("DELETE FROM import_batches WHERE id = ?")
        .bind(batch_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Erreur suppression batch: {}", e))?;

    Ok(deleted)
}

// === Splits ===

/// Create splits for a transaction. Validates that the sum of splits equals the transaction amount.
/// Clears any existing series_id on the transaction (split replaces single-category).
#[command]
pub async fn create_splits(
    transaction_id: i64,
    splits: Vec<SplitInput>,
    db: tauri::State<'_, DbInstances>,
) -> Result<Vec<Split>, String> {
    if splits.is_empty() {
        return Err("Au moins un split requis".to_string());
    }

    let pool = get_db_pool(&db).await?;

    // Get the transaction amount
    let row: (i64,) = sqlx::query_as("SELECT amount FROM transactions WHERE id = ?")
        .bind(transaction_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Transaction introuvable: {}", e))?;
    let tx_amount = row.0;

    // Validate sum
    let sum: i64 = splits.iter().map(|s| s.amount_cents).sum();
    if sum != tx_amount {
        return Err(format!(
            "La somme des splits ({}) ne correspond pas au montant de la transaction ({})",
            sum, tx_amount
        ));
    }

    let mut db_tx = pool.begin().await.map_err(|e| format!("Erreur début transaction: {}", e))?;

    // Delete any existing splits
    sqlx::query("DELETE FROM transaction_splits WHERE transaction_id = ?")
        .bind(transaction_id)
        .execute(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur suppression splits: {}", e))?;

    // Save original series_id/sub_series_id before clearing (for restore on delete)
    let orig: (Option<i64>, Option<i64>) = sqlx::query_as(
        "SELECT series_id, sub_series_id FROM transactions WHERE id = ?"
    )
        .bind(transaction_id)
        .fetch_one(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur lecture transaction: {}", e))?;

    sqlx::query(
        "UPDATE transactions SET pre_split_series_id = ?, pre_split_sub_series_id = ?, series_id = NULL, sub_series_id = NULL WHERE id = ?"
    )
        .bind(orig.0)
        .bind(orig.1)
        .bind(transaction_id)
        .execute(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur mise à jour transaction: {}", e))?;

    // Insert new splits
    for s in &splits {
        sqlx::query(
            "INSERT INTO transaction_splits (transaction_id, series_id, sub_series_id, amount, note) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(transaction_id)
        .bind(s.series_id)
        .bind(s.sub_series_id)
        .bind(s.amount_cents)
        .bind(&s.note)
        .execute(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur insertion split: {}", e))?;
    }

    db_tx.commit().await.map_err(|e| format!("Erreur commit: {}", e))?;

    // Return the newly created splits
    get_splits_internal(&pool, transaction_id).await
}

/// Get all splits for a transaction
#[command]
pub async fn get_splits(
    transaction_id: i64,
    db: tauri::State<'_, DbInstances>,
) -> Result<Vec<Split>, String> {
    let pool = get_db_pool(&db).await?;
    get_splits_internal(&pool, transaction_id).await
}

/// Delete all splits for a transaction (reverts to unsplit, restores original series)
#[command]
pub async fn delete_splits(
    transaction_id: i64,
    db: tauri::State<'_, DbInstances>,
) -> Result<(), String> {
    let pool = get_db_pool(&db).await?;
    let mut db_tx = pool.begin().await.map_err(|e| format!("Erreur début transaction: {}", e))?;

    // Delete splits
    sqlx::query("DELETE FROM transaction_splits WHERE transaction_id = ?")
        .bind(transaction_id)
        .execute(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur suppression splits: {}", e))?;

    // Restore original series_id/sub_series_id from pre_split columns
    sqlx::query(
        "UPDATE transactions SET series_id = pre_split_series_id, sub_series_id = pre_split_sub_series_id, pre_split_series_id = NULL, pre_split_sub_series_id = NULL WHERE id = ?"
    )
        .bind(transaction_id)
        .execute(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur restauration catégorie: {}", e))?;

    db_tx.commit().await.map_err(|e| format!("Erreur commit: {}", e))?;
    Ok(())
}

/// Update a single split line (validates sum still matches transaction amount)
#[command]
pub async fn update_split(
    split_id: i64,
    amount_cents: i64,
    series_id: i64,
    sub_series_id: Option<i64>,
    note: Option<String>,
    db: tauri::State<'_, DbInstances>,
) -> Result<(), String> {
    let pool = get_db_pool(&db).await?;

    // Get the transaction_id for this split
    let (tx_id,): (i64,) = sqlx::query_as(
        "SELECT transaction_id FROM transaction_splits WHERE id = ?"
    )
        .bind(split_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Split introuvable: {}", e))?;

    // Get the transaction amount
    let (tx_amount,): (i64,) = sqlx::query_as(
        "SELECT amount FROM transactions WHERE id = ?"
    )
        .bind(tx_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Transaction introuvable: {}", e))?;

    // Calculate what the new sum would be after this update
    let (current_sum,): (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount), 0) FROM transaction_splits WHERE transaction_id = ? AND id != ?"
    )
        .bind(tx_id)
        .bind(split_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Erreur calcul somme: {}", e))?;

    let new_sum = current_sum + amount_cents;
    if new_sum != tx_amount {
        return Err(format!(
            "La somme des splits ({}) ne correspondrait plus au montant de la transaction ({})",
            new_sum, tx_amount
        ));
    }

    sqlx::query("UPDATE transaction_splits SET amount = ?, series_id = ?, sub_series_id = ?, note = ? WHERE id = ?")
        .bind(amount_cents)
        .bind(series_id)
        .bind(sub_series_id)
        .bind(&note)
        .bind(split_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Erreur mise à jour split: {}", e))?;
    Ok(())
}

async fn get_splits_internal(pool: &sqlx::SqlitePool, transaction_id: i64) -> Result<Vec<Split>, String> {
    let rows: Vec<(i64, i64, i64, Option<i64>, i64, Option<String>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT ts.id, ts.transaction_id, ts.series_id, ts.sub_series_id, ts.amount, ts.note, ts.created_at, bs.name, ss.name
         FROM transaction_splits ts
         LEFT JOIN budget_series bs ON ts.series_id = bs.id
         LEFT JOIN sub_series ss ON ts.sub_series_id = ss.id
         WHERE ts.transaction_id = ?
         ORDER BY ts.id"
    )
    .bind(transaction_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Erreur lecture splits: {}", e))?;

    Ok(rows.into_iter().map(|r| Split {
        id: r.0,
        transaction_id: r.1,
        series_id: r.2,
        sub_series_id: r.3,
        amount: r.4,
        note: r.5,
        created_at: r.6,
        series_name: r.7,
        sub_series_name: r.8,
    }).collect())
}

// === Helpers ===

async fn get_db_pool(db: &DbInstances) -> Result<sqlx::SqlitePool, String> {
    let instances = db.0.read().await;
    let pool = instances
        .get("sqlite:budgetview.db")
        .ok_or("Base de données non initialisée")?;

    let DbPool::Sqlite(pool) = pool;
    Ok(pool.clone())
}

async fn get_existing_transaction_data(
    pool: &sqlx::SqlitePool,
) -> Result<(Vec<String>, Vec<(String, i64, String)>), String> {
    // Get existing FITIDs
    let fitid_rows: Vec<(String,)> = sqlx::query_as(
        "SELECT fitid FROM transactions WHERE fitid IS NOT NULL AND fitid != ''"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Erreur lecture fitids: {}", e))?;
    let existing_fitids: Vec<String> = fitid_rows.into_iter().map(|r| r.0).collect();

    // Get existing (date, amount, label) for fuzzy dedup
    let hash_rows: Vec<(String, i64, String)> = sqlx::query_as(
        "SELECT date, amount, label FROM transactions"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Erreur lecture transactions: {}", e))?;

    Ok((existing_fitids, hash_rows))
}

/// Anonymize a label for auto-categorization.
/// Removes date patterns (DD/MM, DD/MM/YYYY) and long purely-digit words (4+ digits: card/check/ref numbers).
/// Keeps mixed alphanumeric words (3SUISSES, LIDL2GO, PARIS13) and short numbers.
/// Must match the TypeScript anonymizeLabel() in utils/format.ts.
/// Example: 'CARTE 17/03 CARREFOUR CB*1234 5678' → 'CARTE CARREFOUR CB*1234'
fn anonymize_label(label: &str) -> String {
    static RE_DATE: OnceLock<regex::Regex> = OnceLock::new();
    static RE_LONG_DIGITS: OnceLock<regex::Regex> = OnceLock::new();

    let re_date = RE_DATE.get_or_init(|| regex::Regex::new(r"\d{1,2}/\d{1,2}(/\d{2,4})?").unwrap());
    let re_short_digits = RE_LONG_DIGITS.get_or_init(|| regex::Regex::new(r"^\d{4,}$").unwrap());

    let s = re_date.replace_all(label, "");
    s.split_whitespace()
        .filter(|word| !word.is_empty() && !re_short_digits.is_match(word))
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase()
}

/// Check if a label corresponds to a check, cash withdrawal, or cash deposit (excluded from auto-cat)
fn is_excluded_from_auto_categorization(label: &str) -> bool {
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        regex::Regex::new(r"(?i)\b(cheque|chèque|chq|retrait\s*(dab|gab)?|remise\s*esp|depot\s*esp|versement\s*esp)\b").unwrap()
    });
    re.is_match(label)
}
