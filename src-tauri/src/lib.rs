mod commands;
mod db;
mod export;
mod import;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::ImportCache(std::sync::Mutex::new(
            std::collections::HashMap::new(),
        )))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:budgetview.db", db::get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::import_preview,
            commands::import_confirm,
            commands::import_rollback,
            commands::detect_csv_columns,
            commands::backfill_categorization_labels,
            commands::create_splits,
            commands::get_splits,
            commands::delete_splits,
            commands::update_split,
            commands::get_transactions_with_splits,
            commands::detect_recurring_patterns,
            commands::create_recurring,
            commands::get_recurring_transactions,
            commands::update_recurring,
            commands::delete_recurring,
            commands::check_missing_recurrences,
            export::export_transactions_csv,
            export::export_budget_csv,
            commands::set_app_password,
            commands::verify_app_password,
            commands::has_app_password,
            commands::remove_app_password,
            commands::backup_database,
            commands::restore_database,
            commands::list_backups,
            commands::save_ai_setting,
            commands::get_ai_setting,
            commands::delete_ai_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
