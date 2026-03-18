use tauri::command;
use tauri_plugin_sql::DbInstances;

use crate::commands::get_db_pool;

/// Export transactions to CSV file. Returns number of rows exported.
#[command]
pub async fn export_transactions_csv(
    file_path: String,
    account_id: Option<i64>,
    date_from: Option<String>,
    date_to: Option<String>,
    db: tauri::State<'_, DbInstances>,
) -> Result<usize, String> {
    let pool = get_db_pool(&db).await?;

    // Build query with proper parameterized binds
    let rows: Vec<(String, String, i64, Option<String>, Option<String>, Option<String>)> = if account_id.is_some() && date_from.is_some() && date_to.is_some() {
        sqlx::query_as(
            "SELECT t.date, t.label, t.amount, a.name, bs.name, t.note
             FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id LEFT JOIN budget_series bs ON t.series_id = bs.id
             WHERE t.account_id = ? AND t.date >= ? AND t.date <= ? ORDER BY t.date ASC, t.id ASC"
        ).bind(account_id).bind(&date_from).bind(&date_to).fetch_all(&pool).await
    } else if account_id.is_some() {
        sqlx::query_as(
            "SELECT t.date, t.label, t.amount, a.name, bs.name, t.note
             FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id LEFT JOIN budget_series bs ON t.series_id = bs.id
             WHERE t.account_id = ? ORDER BY t.date ASC, t.id ASC"
        ).bind(account_id).fetch_all(&pool).await
    } else if date_from.is_some() && date_to.is_some() {
        sqlx::query_as(
            "SELECT t.date, t.label, t.amount, a.name, bs.name, t.note
             FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id LEFT JOIN budget_series bs ON t.series_id = bs.id
             WHERE t.date >= ? AND t.date <= ? ORDER BY t.date ASC, t.id ASC"
        ).bind(&date_from).bind(&date_to).fetch_all(&pool).await
    } else {
        sqlx::query_as(
            "SELECT t.date, t.label, t.amount, a.name, bs.name, t.note
             FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id LEFT JOIN budget_series bs ON t.series_id = bs.id
             ORDER BY t.date ASC, t.id ASC"
        ).fetch_all(&pool).await
    }.map_err(|e| format!("Erreur export: {}", e))?;

    let count = rows.len();

    // Build CSV with semicolon separator (French locale)
    let mut csv = String::from("Date;Libellé;Montant;Compte;Catégorie;Note\n");
    for (date, label, amount, account, series, note) in &rows {
        let amount_str = format!("{:.2}", *amount as f64 / 100.0).replace('.', ",");
        csv.push_str(&format!(
            "{};\"{}\";\"{}\";\"{}\";\"{}\";\"{}\"\n",
            date,
            label.replace('"', "\"\""),
            amount_str,
            account.as_deref().unwrap_or(""),
            series.as_deref().unwrap_or(""),
            note.as_deref().unwrap_or("").replace('"', "\"\""),
        ));
    }

    std::fs::write(&file_path, csv.as_bytes())
        .map_err(|e| format!("Erreur écriture fichier: {}", e))?;

    Ok(count)
}

/// Export budget summary to CSV file for a given month/year.
#[command]
pub async fn export_budget_csv(
    file_path: String,
    year: i32,
    month: i32,
    db: tauri::State<'_, DbInstances>,
) -> Result<usize, String> {
    let pool = get_db_pool(&db).await?;

    let start_date = format!("{}-{:02}-01", year, month);
    let end_month = if month == 12 { 1 } else { month + 1 };
    let end_year = if month == 12 { year + 1 } else { year };
    let end_date = format!("{}-{:02}-01", end_year, end_month);

    let rows: Vec<(String, String, Option<i64>, i64)> = sqlx::query_as(
        "SELECT bs.name, bs.budget_area,
                mb.planned_amount,
                COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.series_id = bs.id AND t.date >= ? AND t.date < ?), 0)
         FROM budget_series bs
         LEFT JOIN monthly_budget mb ON mb.series_id = bs.id AND mb.year = ? AND mb.month = ?
         WHERE bs.is_active = 1
         ORDER BY bs.budget_area, bs.name"
    )
    .bind(&start_date)
    .bind(&end_date)
    .bind(year)
    .bind(month)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Erreur export budget: {}", e))?;

    let count = rows.len();

    let mut csv = String::from("Catégorie;Zone;Planifié;Réalisé;Écart\n");
    for (name, area, planned, actual) in &rows {
        let planned_val = planned.unwrap_or(0);
        let diff = actual - planned_val;
        csv.push_str(&format!(
            "\"{}\";\"{}\";\"{}\";\"{}\";\"{}\"",
            name, area,
            format!("{:.2}", planned_val as f64 / 100.0).replace('.', ","),
            format!("{:.2}", *actual as f64 / 100.0).replace('.', ","),
            format!("{:.2}", diff as f64 / 100.0).replace('.', ","),
        ));
        csv.push('\n');
    }

    std::fs::write(&file_path, csv.as_bytes())
        .map_err(|e| format!("Erreur écriture fichier: {}", e))?;

    Ok(count)
}
