import { query, execute } from './db';
import type { Transaction } from '$lib/types';

class TransactionStore {
	transactions = $state<Transaction[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	search = $state('');
	filterAccountId = $state<number | null>(null);
	filterSeriesId = $state<number | null>(null);

	async load() {
		this.loading = true;
		this.error = null;
		try {
			let sql = `
				SELECT t.*, a.name as account_name, bs.name as series_name
				FROM transactions t
				LEFT JOIN accounts a ON t.account_id = a.id
				LEFT JOIN budget_series bs ON t.series_id = bs.id
				WHERE 1=1
			`;
			const params: unknown[] = [];
			let i = 1;

			if (this.filterAccountId) {
				sql += ` AND t.account_id = $${i++}`;
				params.push(this.filterAccountId);
			}
			if (this.filterSeriesId) {
				sql += ` AND t.series_id = $${i++}`;
				params.push(this.filterSeriesId);
			}
			if (this.search) {
				sql += ` AND t.label LIKE $${i++}`;
				params.push(`%${this.search}%`);
			}

			sql += ' ORDER BY t.date DESC, t.id DESC LIMIT 500';

			this.transactions = await query<Transaction>(sql, params);
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Erreur inconnue';
		} finally {
			this.loading = false;
		}
	}

	async create(data: {
		account_id: number;
		date: string;
		label: string;
		amount: number;
		note?: string;
		series_id?: number | null;
	}) {
		await execute(
			'INSERT INTO transactions (account_id, date, label, amount, note, series_id) VALUES ($1, $2, $3, $4, $5, $6)',
			[data.account_id, data.date, data.label, data.amount, data.note ?? null, data.series_id ?? null]
		);
		await this.load();
	}

	async update(id: number, data: Partial<{ label: string; amount: number; date: string; note: string | null; series_id: number | null; account_id: number }>) {
		const fields: string[] = [];
		const values: unknown[] = [];
		let i = 1;

		for (const [key, val] of Object.entries(data)) {
			if (val !== undefined) {
				fields.push(`${key} = $${i++}`);
				values.push(val);
			}
		}

		if (fields.length > 0) {
			values.push(id);
			await execute(`UPDATE transactions SET ${fields.join(', ')} WHERE id = $${i}`, values);
			await this.load();
		}
	}

	async categorize(transactionId: number, seriesId: number | null) {
		await execute('UPDATE transactions SET series_id = $1 WHERE id = $2', [seriesId, transactionId]);

		// If assigning a category, learn the pattern for auto-categorization
		if (seriesId !== null) {
			const tx = this.transactions.find((t) => t.id === transactionId);
			if (tx) {
				const label = (tx.original_label ?? tx.label).toUpperCase().trim();
				// Upsert categorization rule
				await execute(
					`INSERT INTO categorization_rules (pattern, series_id, match_count)
					 VALUES ($1, $2, 1)
					 ON CONFLICT(pattern) DO UPDATE SET
					 series_id = $2, match_count = match_count + 1`,
					[label, seriesId]
				);
			}
		}

		await this.load();
	}

	async remove(id: number) {
		await execute('DELETE FROM transactions WHERE id = $1', [id]);
		await this.load();
	}
}

export const transactionStore = new TransactionStore();
