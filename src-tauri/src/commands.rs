use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::command;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::import::{
    self, CsvConfig, ImportPreview, ImportResult, RawTransaction,
};

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
    let rules: Vec<(String, i64)> = sqlx::query_as(
        "SELECT pattern, series_id FROM categorization_rules ORDER BY match_count DESC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur chargement règles: {}", e))?;

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
    for (i, tx) in transactions.iter().enumerate() {
        if skip_set.contains(&i) {
            continue;
        }

        // Auto-categorize based on rules
        let series_id = find_matching_series(&tx.label, &tx.original_label, &rules);

        sqlx::query(
            "INSERT INTO transactions (account_id, date, label, original_label, amount, note, fitid, import_batch_id, series_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(account_id)
        .bind(&tx.date)
        .bind(&tx.label)
        .bind(&tx.original_label)
        .bind((tx.amount * 100.0).round() as i64)
        .bind(&tx.note)
        .bind(&tx.fitid)
        .bind(batch_id)
        .bind(series_id)
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
    })
}

/// Rollback an import batch (delete all transactions from a batch)
#[command]
pub async fn import_rollback(
    batch_id: i64,
    db: tauri::State<'_, DbInstances>,
) -> Result<usize, String> {
    let pool = get_db_pool(&db).await?;

    let result = sqlx::query("DELETE FROM transactions WHERE import_batch_id = ?")
        .bind(batch_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Erreur rollback: {}", e))?;

    let deleted = result.rows_affected() as usize;

    sqlx::query("DELETE FROM import_batches WHERE id = ?")
        .bind(batch_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Erreur suppression batch: {}", e))?;

    Ok(deleted)
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

fn find_matching_series(label: &str, original_label: &str, rules: &[(String, i64)]) -> Option<i64> {
    let upper_label = label.to_uppercase();
    let upper_original = original_label.to_uppercase();

    for (pattern, series_id) in rules {
        let upper_pattern = pattern.to_uppercase();
        if upper_label.contains(&upper_pattern) || upper_original.contains(&upper_pattern) {
            return Some(*series_id);
        }
    }
    None
}
