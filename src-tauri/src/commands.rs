use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::command;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::import::{
    self, CsvConfig, ImportPreview, ImportResult, RawTransaction,
};

/// Categorization rule loaded from the database
#[derive(Debug, Clone)]
struct CatRule {
    label_exact: String,
    label_normalized: String,
    account_id: i64,
    sign: i32,
    series_id: i64,
    sub_series_id: Option<i64>,
    match_count: i32,
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
    let rule_rows: Vec<(String, String, i64, i32, i64, Option<i64>, i32)> = sqlx::query_as(
        "SELECT label_exact, label_normalized, account_id, sign, series_id, sub_series_id, match_count
         FROM categorization_rules ORDER BY match_count DESC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur chargement règles: {}", e))?;

    let rules: Vec<CatRule> = rule_rows.into_iter().map(|r| CatRule {
        label_exact: r.0,
        label_normalized: r.1,
        account_id: r.2,
        sign: r.3,
        series_id: r.4,
        sub_series_id: r.5,
        match_count: r.6,
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
        let sign: i32 = if amount_cents >= 0 { 1 } else { -1 };
        let label_upper = tx.label.to_uppercase().trim().to_string();
        let label_normalized = normalize_label(&tx.label);

        // Check if excluded from auto-categorization (checks, cash withdrawals/deposits)
        let excluded = is_excluded_from_auto_categorization(&tx.label);

        // Auto-categorize using 4-level matching (strict to loose)
        let (series_id, sub_series_id, is_auto) = if excluded {
            (None, None, false)
        } else {
            find_matching_series_multi_level(&label_upper, &label_normalized, sign, account_id, &rules)
        };

        if is_auto {
            auto_categorized_count += 1;
        }

        sqlx::query(
            "INSERT INTO transactions (account_id, date, label, original_label, amount, note, fitid, import_batch_id, series_id, sub_series_id, is_auto_categorized)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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

/// Normalize a label for fuzzy matching: remove variable parts (dates, card/check numbers, references),
/// lowercase, trim. Must match the TypeScript normalizeLabel() in utils/format.ts.
fn normalize_label(label: &str) -> String {
    let lower = label.to_lowercase();

    // Remove dates (DD/MM, DD/MM/YY, DD/MM/YYYY, DD-MM-YYYY)
    let re_date = regex::Regex::new(r"\b\d{1,2}[/\-\.]\d{1,2}([/\-\.]\d{2,4})?\b").unwrap();
    let s = re_date.replace_all(&lower, "");

    // Remove YYYYMMDD patterns
    let re_ymd = regex::Regex::new(r"\b\d{4}\d{2}\d{2}\b").unwrap();
    let s = re_ymd.replace_all(&s, "");

    // Remove DDMMYY patterns
    let re_dmy = regex::Regex::new(r"\b\d{2}\d{2}\d{2}\b").unwrap();
    let s = re_dmy.replace_all(&s, "");

    // Remove long number sequences (4+ digits: card numbers, references, check numbers)
    let re_long = regex::Regex::new(r"\b\d{4,}\b").unwrap();
    let s = re_long.replace_all(&s, "");

    // Remove isolated 1-3 digit numbers
    let re_short = regex::Regex::new(r"\b\d{1,3}\b").unwrap();
    let s = re_short.replace_all(&s, "");

    // Collapse whitespace
    let re_ws = regex::Regex::new(r"\s+").unwrap();
    re_ws.replace_all(&s, " ").trim().to_string()
}

/// Check if a label corresponds to a check, cash withdrawal, or cash deposit (excluded from auto-cat)
fn is_excluded_from_auto_categorization(label: &str) -> bool {
    let lower = label.to_lowercase();
    let re = regex::Regex::new(r"\b(cheque|chèque|chq|retrait\s*(dab|gab)?|remise\s*esp|depot\s*esp|versement\s*esp)\b").unwrap();
    re.is_match(&lower)
}

/// 4-level matching for auto-categorization (strict to loose).
/// Returns (series_id, sub_series_id, is_auto_categorized).
/// Only auto-assigns if match_count >= 3.
fn find_matching_series_multi_level(
    label_exact_upper: &str,
    label_normalized: &str,
    sign: i32,
    account_id: i64,
    rules: &[CatRule],
) -> (Option<i64>, Option<i64>, bool) {
    // Level 1: exact label + same sign + same account
    for r in rules {
        if r.match_count >= 3
            && r.account_id == account_id
            && r.sign == sign
            && r.label_exact.to_uppercase() == label_exact_upper
        {
            return (Some(r.series_id), r.sub_series_id, true);
        }
    }

    // Level 2: exact label + same account (any sign)
    for r in rules {
        if r.match_count >= 3
            && r.account_id == account_id
            && r.label_exact.to_uppercase() == label_exact_upper
        {
            return (Some(r.series_id), r.sub_series_id, true);
        }
    }

    // Level 3: normalized label + same sign + same account
    for r in rules {
        if r.match_count >= 3
            && r.account_id == account_id
            && r.sign == sign
            && r.label_normalized == label_normalized
        {
            return (Some(r.series_id), r.sub_series_id, true);
        }
    }

    // Level 4: normalized label + same account (any sign)
    for r in rules {
        if r.match_count >= 3
            && r.account_id == account_id
            && r.label_normalized == label_normalized
        {
            return (Some(r.series_id), r.sub_series_id, true);
        }
    }

    (None, None, false)
}
