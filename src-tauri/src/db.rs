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
        Migration {
            version: 6,
            description: "recurring_detection",
            sql: include_str!("../migrations/006_recurring_detection.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "encryption_settings",
            sql: include_str!("../migrations/007_encryption_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "reconciliation_groups_carryover",
            sql: include_str!("../migrations/008_reconciliation_and_groups.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "notes",
            sql: include_str!("../migrations/009_notes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "account_thresholds_and_indexes",
            sql: include_str!("../migrations/010_account_thresholds.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "default_categories",
            sql: include_str!("../migrations/011_default_categories.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "keyword_dictionary",
            sql: include_str!("../migrations/012_keyword_dictionary.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "ai_settings",
            sql: include_str!("../migrations/013_ai_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "transaction_types",
            sql: include_str!("../migrations/014_transaction_types.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
