import { query, execute } from './db';
import type { Transaction } from '$lib/types';
import { toCents, anonymizeLabel, isExcludedFromAutoCategorization } from '$lib/utils/format';
import { categorizationStore } from './categorization.svelte';

class TransactionStore {
	transactions = $state<Transaction[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	search = $state('');
	filterAccountId = $state<number | string>('');
	filterSeriesId = $state<number | string>('');

	async load() {
		this.loading = true;
		this.error = null;
		try {
			let sql = `
				SELECT t.*, a.name as account_name, bs.name as series_name, ss.name as sub_series_name
				FROM transactions t
				LEFT JOIN accounts a ON t.account_id = a.id
				LEFT JOIN budget_series bs ON t.series_id = bs.id
				LEFT JOIN sub_series ss ON t.sub_series_id = ss.id
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
		const labelAnon = anonymizeLabel(data.label);
		await execute(
			'INSERT INTO transactions (account_id, date, label, amount, note, series_id, label_for_categorization) VALUES ($1, $2, $3, $4, $5, $6, $7)',
			[data.account_id, data.date, data.label, toCents(data.amount), data.note ?? null, data.series_id ?? null, labelAnon || null]
		);
		await this.load();
	}

	private static readonly ALLOWED_COLUMNS = new Set(['label', 'amount', 'date', 'note', 'series_id', 'account_id', 'is_reconciled']);

	async update(id: number, data: Partial<{ label: string; amount: number; date: string; note: string | null; series_id: number | null; account_id: number; is_reconciled: number }>) {
		const fields: string[] = [];
		const values: unknown[] = [];
		let i = 1;

		for (const [key, val] of Object.entries(data)) {
			if (val !== undefined && TransactionStore.ALLOWED_COLUMNS.has(key)) {
				fields.push(`${key} = $${i++}`);
				values.push(key === 'amount' ? toCents(val as number) : val);
			}
		}

		// If label changed, update label_for_categorization too
		if (data.label !== undefined) {
			fields.push(`label_for_categorization = $${i++}`);
			values.push(anonymizeLabel(data.label) || null);
		}

		if (fields.length > 0) {
			values.push(id);
			await execute(`UPDATE transactions SET ${fields.join(', ')} WHERE id = $${i}`, values);
			await this.load();
		}
	}

	/**
	 * Categorize a transaction manually.
	 * Learns the pattern and returns the count of similar uncategorized transactions.
	 */
	async categorize(transactionId: number, seriesId: number | null, subSeriesId: number | null = null): Promise<number> {
		await execute(
			'UPDATE transactions SET series_id = $1, sub_series_id = $2, is_auto_categorized = 0 WHERE id = $3',
			[seriesId, subSeriesId, transactionId]
		);

		let similarCount = 0;

		// If assigning a category, learn the pattern
		if (seriesId !== null) {
			const tx = this.transactions.find((t) => t.id === transactionId);
			if (tx && !isExcludedFromAutoCategorization(tx.original_label ?? tx.label)) {
				await categorizationStore.learn(tx, seriesId, subSeriesId);

				// Count similar uncategorized transactions
				const similar = await categorizationStore.findSimilarUncategorized(tx);
				similarCount = similar.length;
			}
		}

		await this.load();
		return similarCount;
	}

	/**
	 * Apply same category to all similar uncategorized transactions.
	 */
	async applyToSimilar(transactionId: number, seriesId: number, subSeriesId: number | null = null): Promise<number> {
		const tx = this.transactions.find((t) => t.id === transactionId);
		if (!tx) return 0;

		const count = await categorizationStore.applyToSimilar(tx, seriesId, subSeriesId);
		await this.load();
		return count;
	}

	async remove(id: number) {
		await execute('DELETE FROM transactions WHERE id = $1', [id]);
		await this.load();
	}
}

export const transactionStore = new TransactionStore();
