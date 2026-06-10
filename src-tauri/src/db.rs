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
            description: "budget_month_shift",
            sql: include_str!("../migrations/014_budget_month_shift.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri_plugin_sql::MigrationKind;

    #[test]
    fn migrations_are_ordered_and_non_empty() {
        let migrations = get_migrations();

        assert_eq!(migrations.len(), 13);
        for (index, migration) in migrations.iter().enumerate() {
            assert_eq!(migration.version, (index + 1) as i64);
            assert!(!migration.description.trim().is_empty());
            assert!(!migration.sql.trim().is_empty());
            assert!(matches!(migration.kind, MigrationKind::Up));
        }
    }

    #[test]
    fn migrations_cover_current_schema_features() {
        let sql = get_migrations()
            .into_iter()
            .map(|migration| migration.sql.to_string())
            .collect::<Vec<_>>()
            .join("\n");

        for required in [
            "CREATE TABLE IF NOT EXISTS accounts",
            "CREATE TABLE IF NOT EXISTS transactions",
            "CREATE TABLE IF NOT EXISTS budget_series",
            "CREATE TABLE IF NOT EXISTS transaction_splits",
            "CREATE TABLE IF NOT EXISTS recurring_transactions",
            "CREATE TABLE IF NOT EXISTS budget_carry_over",
            "CREATE TABLE IF NOT EXISTS app_settings",
            "CREATE TABLE IF NOT EXISTS ai_settings",
            "ALTER TABLE transactions ADD COLUMN is_reconciled",
            "ALTER TABLE accounts ADD COLUMN low_balance_threshold",
        ] {
            assert!(sql.contains(required), "missing migration fragment: {required}");
        }
    }

    #[test]
    fn migration_versions_are_unique() {
        let mut versions = get_migrations()
            .into_iter()
            .map(|migration| migration.version)
            .collect::<Vec<_>>();
        versions.sort_unstable();
        versions.dedup();

        assert_eq!(versions.len(), 13);
    }
}
