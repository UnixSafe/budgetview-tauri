import { query, execute } from './db';

interface Note {
	id: number;
	year: number;
	month: number;
	content: string;
	updated_at: string;
}

class NotesStore {
	content = $state('');
	year = $state(new Date().getFullYear());
	month = $state(new Date().getMonth() + 1);
	loading = $state(false);
	saving = $state(false);

	async load() {
		this.loading = true;
		try {
			const rows = await query<Note>(
				'SELECT * FROM notes WHERE year = $1 AND month = $2',
				[this.year, this.month]
			);
			this.content = rows[0]?.content ?? '';
		} catch {
			this.content = '';
		} finally {
			this.loading = false;
		}
	}

	async save() {
		this.saving = true;
		try {
			await execute(
				`INSERT INTO notes (year, month, content, updated_at)
				 VALUES ($1, $2, $3, datetime('now'))
				 ON CONFLICT(year, month) DO UPDATE SET content = $3, updated_at = datetime('now')`,
				[this.year, this.month, this.content]
			);
		} finally {
			this.saving = false;
		}
	}

	async setMonth(year: number, month: number) {
		this.year = year;
		this.month = month;
		await this.load();
	}
}

export const notesStore = new NotesStore();
