use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "auto_categorization_enhanced",
            sql: include_str!("../migrations/002_auto_categorization.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "simplify_categorization",
            sql: include_str!("../migrations/003_simplify_categorization.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "splits_created_at",
            sql: include_str!("../migrations/004_splits_created_at.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "splits_improvements",
            sql: include_str!("../migrations/005_splits_improvements.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
