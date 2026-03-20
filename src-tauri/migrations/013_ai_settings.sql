-- AI provider settings for auto-categorization
-- API keys are stored encrypted using the app's encryption key
CREATE TABLE IF NOT EXISTS ai_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
