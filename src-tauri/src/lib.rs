mod commands;
mod db;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
