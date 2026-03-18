-- Notes system: global notes per month (inspired by BudgetView Java Notes model)
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, month)
);
