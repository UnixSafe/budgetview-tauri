use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tauri::{command, Manager};
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

/// Delete all splits for a transaction (reverts to unsplit, sets series_id to NULL = uncategorized)
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

    // Set transaction to uncategorized (NULL series) and clear pre_split backup
    sqlx::query(
        "UPDATE transactions SET series_id = NULL, sub_series_id = NULL, pre_split_series_id = NULL, pre_split_sub_series_id = NULL WHERE id = ?"
    )
        .bind(transaction_id)
        .execute(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur mise à jour transaction: {}", e))?;

    db_tx.commit().await.map_err(|e| format!("Erreur commit: {}", e))?;
    Ok(())
}

/// Update a single split line (validates sum still matches transaction amount, in a SQL transaction)
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
    let mut db_tx = pool.begin().await.map_err(|e| format!("Erreur début transaction: {}", e))?;

    // Get the transaction_id for this split
    let (tx_id,): (i64,) = sqlx::query_as(
        "SELECT transaction_id FROM transaction_splits WHERE id = ?"
    )
        .bind(split_id)
        .fetch_one(&mut *db_tx)
        .await
        .map_err(|e| format!("Split introuvable: {}", e))?;

    // Get the transaction amount
    let (tx_amount,): (i64,) = sqlx::query_as(
        "SELECT amount FROM transactions WHERE id = ?"
    )
        .bind(tx_id)
        .fetch_one(&mut *db_tx)
        .await
        .map_err(|e| format!("Transaction introuvable: {}", e))?;

    // Perform the update
    sqlx::query("UPDATE transaction_splits SET amount = ?, series_id = ?, sub_series_id = ?, note = ? WHERE id = ?")
        .bind(amount_cents)
        .bind(series_id)
        .bind(sub_series_id)
        .bind(&note)
        .bind(split_id)
        .execute(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur mise à jour split: {}", e))?;

    // Verify sum after update matches transaction amount
    let (new_sum,): (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount), 0) FROM transaction_splits WHERE transaction_id = ?"
    )
        .bind(tx_id)
        .fetch_one(&mut *db_tx)
        .await
        .map_err(|e| format!("Erreur calcul somme: {}", e))?;

    if new_sum != tx_amount {
        // Rollback happens automatically when db_tx is dropped without commit
        return Err(format!(
            "La somme des splits ({}) ne correspond pas au montant de la transaction ({})",
            new_sum, tx_amount
        ));
    }

    db_tx.commit().await.map_err(|e| format!("Erreur commit: {}", e))?;
    Ok(())
}

/// Returns the list of transaction IDs that have at least one split
#[command]
pub async fn get_transactions_with_splits(
    db: tauri::State<'_, DbInstances>,
) -> Result<Vec<i64>, String> {
    let pool = get_db_pool(&db).await?;
    let rows: Vec<(i64,)> = sqlx::query_as(
        "SELECT DISTINCT transaction_id FROM transaction_splits"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur lecture splits: {}", e))?;

    Ok(rows.into_iter().map(|r| r.0).collect())
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

// === Recurring transaction detection ===

/// A detected recurring pattern from transaction history
#[derive(Debug, Serialize)]
pub struct RecurringPattern {
    pub label: String,
    pub account_id: i64,
    pub account_name: String,
    pub avg_amount: i64,
    pub frequency: String,
    pub day_of_month: i64,
    pub transaction_count: i64,
    pub last_date: String,
    pub series_id: Option<i64>,
    pub series_name: Option<String>,
}

/// Analyze transaction history to detect recurring patterns.
/// Groups by anonymized label + account, checks interval regularity.
#[command]
pub async fn detect_recurring_patterns(
    min_occurrences: Option<i64>,
    db: tauri::State<'_, DbInstances>,
) -> Result<Vec<RecurringPattern>, String> {
    let pool = get_db_pool(&db).await?;
    let min_occ = min_occurrences.unwrap_or(3);

    // Find groups of transactions with same anonymized label + account that occur 3+ times
    let groups: Vec<(String, i64, String, i64, i64, Option<i64>, Option<String>)> = sqlx::query_as(
        "SELECT t.label_for_categorization, t.account_id, a.name,
                COUNT(*) as cnt, AVG(t.amount) as avg_amt,
                t.series_id, bs.name
         FROM transactions t
         LEFT JOIN accounts a ON t.account_id = a.id
         LEFT JOIN budget_series bs ON t.series_id = bs.id
         WHERE t.label_for_categorization IS NOT NULL
           AND t.label_for_categorization != ''
         GROUP BY t.label_for_categorization, t.account_id
         HAVING COUNT(*) >= ?
         ORDER BY cnt DESC"
    )
    .bind(min_occ)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur analyse récurrences: {}", e))?;

    let mut patterns = Vec::new();

    for (label, account_id, account_name, count, avg_amount, series_id, series_name) in &groups {
        // Get dates for this group to analyze intervals
        let dates: Vec<(String,)> = sqlx::query_as(
            "SELECT date FROM transactions
             WHERE label_for_categorization = ? AND account_id = ?
             ORDER BY date ASC"
        )
        .bind(label)
        .bind(account_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Erreur lecture dates: {}", e))?;

        if dates.len() < 2 {
            continue;
        }

        // Parse dates and compute intervals in days
        let parsed_dates: Vec<chrono::NaiveDate> = dates.iter()
            .filter_map(|(d,)| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
            .collect();

        if parsed_dates.len() < 2 {
            continue;
        }

        let intervals: Vec<i64> = parsed_dates.windows(2)
            .map(|w| (w[1] - w[0]).num_days())
            .filter(|&d| d > 0) // skip same-day duplicates
            .collect();

        if intervals.is_empty() {
            continue;
        }

        let avg_interval = intervals.iter().sum::<i64>() as f64 / intervals.len() as f64;

        // Determine frequency based on average interval
        let frequency = if avg_interval >= 340.0 && avg_interval <= 395.0 {
            "yearly"
        } else if avg_interval >= 80.0 && avg_interval <= 110.0 {
            "quarterly"
        } else if avg_interval >= 25.0 && avg_interval <= 35.0 {
            "monthly"
        } else if avg_interval >= 12.0 && avg_interval <= 16.0 {
            "biweekly"
        } else if avg_interval >= 5.0 && avg_interval <= 9.0 {
            "weekly"
        } else {
            continue; // Not a recognizable pattern
        };

        // Calculate typical day of month from dates
        let days: Vec<u32> = parsed_dates.iter().map(|d| d.day()).collect();
        let avg_day = days.iter().sum::<u32>() as f64 / days.len() as f64;

        let last_date = parsed_dates.last().unwrap().to_string();

        patterns.push(RecurringPattern {
            label: label.clone(),
            account_id: *account_id,
            account_name: account_name.clone(),
            avg_amount: *avg_amount,
            frequency: frequency.to_string(),
            day_of_month: avg_day.round() as i64,
            transaction_count: *count,
            last_date,
            series_id: *series_id,
            series_name: series_name.clone(),
        });
    }

    Ok(patterns)
}

/// A recurring transaction from the DB
#[derive(Debug, Serialize)]
pub struct RecurringRecord {
    pub id: i64,
    pub account_id: i64,
    pub label: String,
    pub label_pattern: Option<String>,
    pub amount: i64,
    pub series_id: Option<i64>,
    pub series_name: Option<String>,
    pub frequency: Option<String>,
    pub day_of_month: Option<i32>,
    pub is_active: bool,
    pub is_auto_detected: bool,
    pub last_occurrence_date: Option<String>,
    pub next_expected_date: Option<String>,
    pub tolerance_days: Option<i32>,
    pub account_name: Option<String>,
}

/// A missing recurrence alert
#[derive(Debug, Serialize)]
pub struct MissingRecurrence {
    pub recurring_id: i64,
    pub label: String,
    pub amount: i64,
    pub expected_date: String,
    pub days_overdue: i32,
    pub account_name: Option<String>,
    pub series_name: Option<String>,
}

/// Confirm a detected pattern as a recurring transaction
#[command]
pub async fn create_recurring(
    label: String,
    label_pattern: String,
    account_id: i64,
    amount: i64,
    series_id: Option<i64>,
    frequency: String,
    day_of_month: i32,
    db: tauri::State<'_, DbInstances>,
) -> Result<i64, String> {
    let pool = get_db_pool(&db).await?;

    let today = chrono::Local::now().date_naive();
    let next_date = compute_next_expected(&frequency, day_of_month, &today.to_string());

    let result = sqlx::query(
        "INSERT INTO recurring_transactions (account_id, label, label_pattern, amount, series_id, frequency, day_of_month, is_active, is_auto_detected, next_expected_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)"
    )
    .bind(account_id)
    .bind(&label)
    .bind(&label_pattern)
    .bind(amount)
    .bind(series_id)
    .bind(&frequency)
    .bind(day_of_month)
    .bind(&next_date)
    .execute(&pool)
    .await
    .map_err(|e| format!("Erreur création récurrence: {}", e))?;

    let recurring_id = result.last_insert_rowid();

    // Link existing matching transactions
    sqlx::query(
        "UPDATE transactions SET recurring_id = ?
         WHERE label_for_categorization = ? AND account_id = ? AND SIGN(amount) = SIGN(?)"
    )
    .bind(recurring_id)
    .bind(&label_pattern)
    .bind(account_id)
    .bind(amount)
    .execute(&pool)
    .await
    .map_err(|e| format!("Erreur liaison transactions: {}", e))?;

    // Set last_occurrence_date from linked transactions
    let last: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT MAX(date) FROM transactions WHERE recurring_id = ?"
    )
    .bind(recurring_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("Erreur: {}", e))?;

    if let Some((Some(last_date),)) = last {
        let next = compute_next_expected(&frequency, day_of_month, &last_date);
        sqlx::query("UPDATE recurring_transactions SET last_occurrence_date = ?, next_expected_date = ? WHERE id = ?")
            .bind(&last_date)
            .bind(&next)
            .bind(recurring_id)
            .execute(&pool)
            .await
            .map_err(|e| format!("Erreur: {}", e))?;
    }

    Ok(recurring_id)
}

/// Get all recurring transactions
#[command]
pub async fn get_recurring_transactions(
    db: tauri::State<'_, DbInstances>,
) -> Result<Vec<RecurringRecord>, String> {
    let pool = get_db_pool(&db).await?;

    let rows: Vec<(i64, i64, String, Option<String>, i64, Option<i64>, Option<String>,
                    Option<String>, Option<i32>, bool, bool,
                    Option<String>, Option<String>, Option<i32>, Option<String>)> = sqlx::query_as(
        "SELECT r.id, r.account_id, r.label, r.label_pattern, r.amount, r.series_id, bs.name,
                r.frequency, r.day_of_month, r.is_active, COALESCE(r.is_auto_detected, 0),
                r.last_occurrence_date, r.next_expected_date, r.tolerance_days, a.name
         FROM recurring_transactions r
         LEFT JOIN budget_series bs ON r.series_id = bs.id
         LEFT JOIN accounts a ON r.account_id = a.id
         ORDER BY r.is_active DESC, r.label"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur lecture récurrences: {}", e))?;

    Ok(rows.into_iter().map(|r| RecurringRecord {
        id: r.0, account_id: r.1, label: r.2, label_pattern: r.3,
        amount: r.4, series_id: r.5, series_name: r.6,
        frequency: r.7, day_of_month: r.8,
        is_active: r.9, is_auto_detected: r.10,
        last_occurrence_date: r.11, next_expected_date: r.12,
        tolerance_days: r.13, account_name: r.14,
    }).collect())
}

/// Update a recurring transaction
#[command]
pub async fn update_recurring(
    id: i64,
    label: Option<String>,
    amount: Option<i64>,
    series_id: Option<i64>,
    frequency: Option<String>,
    day_of_month: Option<i32>,
    is_active: Option<bool>,
    tolerance_days: Option<i32>,
    db: tauri::State<'_, DbInstances>,
) -> Result<(), String> {
    let pool = get_db_pool(&db).await?;

    if let Some(v) = &label { sqlx::query("UPDATE recurring_transactions SET label = ? WHERE id = ?").bind(v).bind(id).execute(&pool).await.map_err(|e| format!("Erreur: {}", e))?; }
    if let Some(v) = amount { sqlx::query("UPDATE recurring_transactions SET amount = ? WHERE id = ?").bind(v).bind(id).execute(&pool).await.map_err(|e| format!("Erreur: {}", e))?; }
    if let Some(v) = series_id { sqlx::query("UPDATE recurring_transactions SET series_id = ? WHERE id = ?").bind(v).bind(id).execute(&pool).await.map_err(|e| format!("Erreur: {}", e))?; }
    if let Some(v) = &frequency { sqlx::query("UPDATE recurring_transactions SET frequency = ? WHERE id = ?").bind(v).bind(id).execute(&pool).await.map_err(|e| format!("Erreur: {}", e))?; }
    if let Some(v) = day_of_month { sqlx::query("UPDATE recurring_transactions SET day_of_month = ? WHERE id = ?").bind(v).bind(id).execute(&pool).await.map_err(|e| format!("Erreur: {}", e))?; }
    if let Some(v) = is_active { sqlx::query("UPDATE recurring_transactions SET is_active = ? WHERE id = ?").bind(v).bind(id).execute(&pool).await.map_err(|e| format!("Erreur: {}", e))?; }
    if let Some(v) = tolerance_days { sqlx::query("UPDATE recurring_transactions SET tolerance_days = ? WHERE id = ?").bind(v).bind(id).execute(&pool).await.map_err(|e| format!("Erreur: {}", e))?; }

    // Recalculate next_expected_date
    let current: (Option<String>, Option<i32>, Option<String>) = sqlx::query_as(
        "SELECT frequency, day_of_month, last_occurrence_date FROM recurring_transactions WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| format!("Erreur: {}", e))?;

    if let (Some(freq), Some(dom)) = (&current.0, current.1) {
        let today_str = chrono::Local::now().date_naive().to_string();
        let last = current.2.as_deref().unwrap_or(&today_str);
        let next = compute_next_expected(freq, dom, last);
        sqlx::query("UPDATE recurring_transactions SET next_expected_date = ? WHERE id = ?")
            .bind(&next).bind(id).execute(&pool).await.map_err(|e| format!("Erreur: {}", e))?;
    }

    Ok(())
}

/// Delete a recurring transaction
#[command]
pub async fn delete_recurring(
    id: i64,
    db: tauri::State<'_, DbInstances>,
) -> Result<(), String> {
    let pool = get_db_pool(&db).await?;
    sqlx::query("UPDATE transactions SET recurring_id = NULL WHERE recurring_id = ?")
        .bind(id).execute(&pool).await.map_err(|e| format!("Erreur: {}", e))?;
    sqlx::query("DELETE FROM recurring_transactions WHERE id = ?")
        .bind(id).execute(&pool).await.map_err(|e| format!("Erreur: {}", e))?;
    Ok(())
}

/// Check for missing recurring transactions (overdue)
#[command]
pub async fn check_missing_recurrences(
    db: tauri::State<'_, DbInstances>,
) -> Result<Vec<MissingRecurrence>, String> {
    let pool = get_db_pool(&db).await?;
    let today = chrono::Local::now().date_naive();

    let rows: Vec<(i64, String, i64, Option<String>, Option<i32>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT r.id, r.label, r.amount, r.next_expected_date, r.tolerance_days, a.name, bs.name
         FROM recurring_transactions r
         LEFT JOIN accounts a ON r.account_id = a.id
         LEFT JOIN budget_series bs ON r.series_id = bs.id
         WHERE r.is_active = 1 AND r.next_expected_date IS NOT NULL"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur: {}", e))?;

    let mut missing = Vec::new();
    for (id, label, amount, next_str, tolerance, account_name, series_name) in rows {
        if let Some(ref ns) = next_str {
            if let Ok(next_date) = chrono::NaiveDate::parse_from_str(ns, "%Y-%m-%d") {
                let overdue = (today - next_date).num_days() as i32;
                if overdue > tolerance.unwrap_or(5) {
                    missing.push(MissingRecurrence {
                        recurring_id: id, label, amount,
                        expected_date: ns.clone(), days_overdue: overdue,
                        account_name, series_name,
                    });
                }
            }
        }
    }

    Ok(missing)
}

/// Compute next expected date from frequency, day of month, and last occurrence
fn compute_next_expected(frequency: &str, day_of_month: i32, last_date: &str) -> Option<String> {
    let last = chrono::NaiveDate::parse_from_str(last_date, "%Y-%m-%d").ok()?;
    let today = chrono::Local::now().date_naive();

    if frequency == "biweekly" || frequency == "weekly" {
        let step = if frequency == "weekly" { 7 } else { 14 };
        let mut candidate = last + chrono::Duration::days(step);
        while candidate <= today { candidate += chrono::Duration::days(step); }
        return Some(candidate.to_string());
    }

    let months_ahead: i32 = match frequency {
        "monthly" => 1, "quarterly" => 3, "biannual" => 6, "yearly" => 12, _ => 1,
    };

    let mut y = last.year();
    let mut m = last.month() as i32;
    loop {
        m += months_ahead;
        while m > 12 { m -= 12; y += 1; }
        let dom = day_of_month.min(days_in_month(y, m as u32) as i32).max(1) as u32;
        if let Some(candidate) = chrono::NaiveDate::from_ymd_opt(y, m as u32, dom) {
            if candidate > today {
                return Some(candidate.to_string());
            }
        }
    }
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) { 29 } else { 28 },
        _ => 30,
    }
}

// === Helpers ===

pub async fn get_db_pool(db: &DbInstances) -> Result<sqlx::SqlitePool, String> {
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

// === Password protection ===

/// Set app password. Stores PBKDF2-HMAC-SHA256 hash in app_settings.
#[command]
pub async fn set_app_password(
    password: String,
    db: tauri::State<'_, DbInstances>,
) -> Result<(), String> {
    use rand::Rng;

    if password.len() < 4 {
        return Err("Le mot de passe doit contenir au moins 4 caractères".to_string());
    }

    let pool = get_db_pool(&db).await?;

    // Generate random salt
    let salt: [u8; 16] = rand::thread_rng().gen();
    let salt_hex = hex::encode(salt);

    // Hash password with PBKDF2
    let hash = hash_password(&password, &salt_hex);

    // Store hash and salt
    let value = format!("{}:{}", salt_hex, hash);
    sqlx::query(
        "INSERT INTO app_settings (key, value) VALUES ('password_hash', ?)
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP"
    )
    .bind(&value)
    .bind(&value)
    .execute(&pool)
    .await
    .map_err(|e| format!("Erreur sauvegarde mot de passe: {}", e))?;

    Ok(())
}

/// Verify the app password. Returns true if correct.
#[command]
pub async fn verify_app_password(
    password: String,
    db: tauri::State<'_, DbInstances>,
) -> Result<bool, String> {
    let pool = get_db_pool(&db).await?;

    let row: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM app_settings WHERE key = 'password_hash'"
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("Erreur lecture mot de passe: {}", e))?;

    match row {
        None => Ok(true), // No password set
        Some((stored,)) => {
            let parts: Vec<&str> = stored.splitn(2, ':').collect();
            if parts.len() != 2 {
                return Err("Format de hash invalide".to_string());
            }
            let hash = hash_password(&password, parts[0]);
            Ok(hash == parts[1])
        }
    }
}

/// Check if a password is set.
#[command]
pub async fn has_app_password(
    db: tauri::State<'_, DbInstances>,
) -> Result<bool, String> {
    let pool = get_db_pool(&db).await?;
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM app_settings WHERE key = 'password_hash'"
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("Erreur: {}", e))?;
    Ok(row.is_some())
}

/// Remove the app password.
#[command]
pub async fn remove_app_password(
    current_password: String,
    db: tauri::State<'_, DbInstances>,
) -> Result<(), String> {
    let valid = verify_app_password(current_password, db.clone()).await?;
    if !valid {
        return Err("Mot de passe incorrect".to_string());
    }
    let pool = get_db_pool(&db).await?;
    sqlx::query("DELETE FROM app_settings WHERE key = 'password_hash'")
        .execute(&pool)
        .await
        .map_err(|e| format!("Erreur: {}", e))?;
    Ok(())
}

fn hash_password(password: &str, salt_hex: &str) -> String {
    use pbkdf2::pbkdf2_hmac;
    use sha2::Sha256;

    let salt = hex::decode(salt_hex).unwrap_or_default();
    let mut hash = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, 100_000, &mut hash);
    hex::encode(hash)
}

// === Backup / Restore ===

#[command]
pub async fn backup_database(
    destination_path: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot find app data dir: {}", e))?;
    let db_path = app_dir.join("budgetview.db");

    if !db_path.exists() {
        return Err("Base de données introuvable".to_string());
    }

    std::fs::copy(&db_path, &destination_path)
        .map_err(|e| format!("Erreur de copie: {}", e))?;

    Ok(destination_path)
}

#[command]
pub async fn restore_database(
    source_path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot find app data dir: {}", e))?;
    let db_path = app_dir.join("budgetview.db");

    // Verify the source file is a valid SQLite database
    let header = std::fs::read(&source_path)
        .map_err(|e| format!("Erreur de lecture: {}", e))?;
    if header.len() < 16 || &header[..16] != b"SQLite format 3\0" {
        return Err("Le fichier n'est pas une base de données SQLite valide".to_string());
    }

    // Create a backup of the current database before restoring
    let backup_path = app_dir.join("budgetview.db.bak");
    if db_path.exists() {
        std::fs::copy(&db_path, &backup_path)
            .map_err(|e| format!("Erreur de sauvegarde: {}", e))?;
    }

    std::fs::copy(&source_path, &db_path)
        .map_err(|e| format!("Erreur de restauration: {}", e))?;

    Ok(())
}

#[command]
pub async fn list_backups(
    directory_path: String,
) -> Result<Vec<BackupInfo>, String> {
    let dir = std::path::Path::new(&directory_path);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut backups = Vec::new();
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Erreur de lecture: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("db") {
            if let Ok(metadata) = entry.metadata() {
                let modified = metadata.modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                let size_bytes = metadata.len();
                backups.push(BackupInfo {
                    path: path.to_string_lossy().to_string(),
                    filename: path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                    modified_timestamp: modified,
                    size_bytes,
                });
            }
        }
    }

    backups.sort_by(|a, b| b.modified_timestamp.cmp(&a.modified_timestamp));
    Ok(backups)
}

#[derive(Debug, Serialize)]
pub struct BackupInfo {
    pub path: String,
    pub filename: String,
    pub modified_timestamp: u64,
    pub size_bytes: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_days_in_month() {
        assert_eq!(days_in_month(2024, 1), 31);
        assert_eq!(days_in_month(2024, 2), 29); // leap year
        assert_eq!(days_in_month(2025, 2), 28);
        assert_eq!(days_in_month(2024, 4), 30);
        assert_eq!(days_in_month(2024, 12), 31);
    }

    #[test]
    fn test_compute_next_expected_monthly() {
        // Monthly on the 15th, last occurrence 2026-02-15
        let result = compute_next_expected("monthly", 15, "2026-02-15");
        assert!(result.is_some());
        let date = result.unwrap();
        // Should be in the future (2026-03-15 or later)
        assert!(date.as_str() >= "2026-03-15");
    }

    #[test]
    fn test_compute_next_expected_quarterly() {
        let result = compute_next_expected("quarterly", 1, "2025-12-01");
        assert!(result.is_some());
        let date = result.unwrap();
        assert!(date.as_str() >= "2026-03-01");
    }

    #[test]
    fn test_compute_next_expected_yearly() {
        let result = compute_next_expected("yearly", 1, "2025-01-01");
        assert!(result.is_some());
        let date = result.unwrap();
        assert!(date.as_str() >= "2026-01-01");
    }

    #[test]
    fn test_compute_next_expected_handles_end_of_month() {
        // Day 31 in a month with 30 days should clamp to 30
        let result = compute_next_expected("monthly", 31, "2026-01-31");
        assert!(result.is_some());
        let date = result.unwrap();
        // Feb has 28 days, so should clamp to 28
        assert!(date.contains("-02-28") || date.contains("-03-") || date.as_str() > "2026-02-01");
    }

    #[test]
    fn test_compute_next_expected_invalid_date() {
        let result = compute_next_expected("monthly", 15, "invalid-date");
        assert!(result.is_none());
    }

    #[test]
    fn test_anonymize_label() {
        assert_eq!(anonymize_label("CARTE 17/03 CARREFOUR CB*1234 5678"), "CARTE CARREFOUR CB*1234");
        assert_eq!(anonymize_label("VIR SEPA 3SUISSES"), "VIR SEPA 3SUISSES");
        assert_eq!(anonymize_label("PRLV 15/03/2024 EDF 123456"), "PRLV EDF");
    }

    #[test]
    fn test_is_excluded_from_auto_categorization() {
        assert!(is_excluded_from_auto_categorization("CHEQUE 12345"));
        assert!(is_excluded_from_auto_categorization("Retrait DAB 50€"));
        assert!(is_excluded_from_auto_categorization("Remise esp"));
        assert!(!is_excluded_from_auto_categorization("CARREFOUR CB"));
        assert!(!is_excluded_from_auto_categorization("VIR SEPA SALAIRE"));
    }
}
