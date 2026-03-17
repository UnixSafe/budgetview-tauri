import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
	if (!db) {
		db = await Database.load('sqlite:budgetview.db');
	}
	return db;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
	const database = await getDb();
	return database.select<T[]>(sql, params);
}

export async function execute(sql: string, params: unknown[] = []) {
	const database = await getDb();
	return database.execute(sql, params);
}
