import { query, execute } from './db';
import type { Transaction } from '$lib/types';
import { toCents, normalizeLabel, isExcludedFromAutoCategorization } from '$lib/utils/format';

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
			[data.account_id, data.date, data.label, toCents(data.amount), data.note ?? null, data.series_id ?? null]
		);
		await this.load();
	}

	private static readonly ALLOWED_COLUMNS = new Set(['label', 'amount', 'date', 'note', 'series_id', 'account_id']);

	async update(id: number, data: Partial<{ label: string; amount: number; date: string; note: string | null; series_id: number | null; account_id: number }>) {
		const fields: string[] = [];
		const values: unknown[] = [];
		let i = 1;

		for (const [key, val] of Object.entries(data)) {
			if (val !== undefined && TransactionStore.ALLOWED_COLUMNS.has(key)) {
				fields.push(`${key} = $${i++}`);
				values.push(key === 'amount' ? toCents(val as number) : val);
			}
		}

		if (fields.length > 0) {
			values.push(id);
			await execute(`UPDATE transactions SET ${fields.join(', ')} WHERE id = $${i}`, values);
			await this.load();
		}
	}

	async categorize(transactionId: number, seriesId: number | null, subSeriesId: number | null = null) {
		await execute('UPDATE transactions SET series_id = $1, sub_series_id = $2, is_auto_categorized = 0 WHERE id = $3', [seriesId, subSeriesId, transactionId]);

		// If assigning a category, learn the pattern for auto-categorization
		if (seriesId !== null) {
			const tx = this.transactions.find((t) => t.id === transactionId);
			if (tx && !isExcludedFromAutoCategorization(tx.original_label ?? tx.label)) {
				const labelExact = (tx.original_label ?? tx.label).toUpperCase().trim();
				const labelNorm = normalizeLabel(tx.original_label ?? tx.label);
				const sign = tx.amount >= 0 ? 1 : -1;

				// Check if a rule already exists for this exact label + account + sign
				const existing = await query<{ id: number; series_id: number; match_count: number }>(
					'SELECT id, series_id, match_count FROM categorization_rules WHERE label_exact = $1 AND account_id = $2 AND sign = $3',
					[labelExact, tx.account_id, sign]
				);

				if (existing.length > 0) {
					const rule = existing[0];
					if (rule.series_id === seriesId) {
						// Same series → increment match_count
						await execute(
							'UPDATE categorization_rules SET match_count = match_count + 1, last_used = CURRENT_TIMESTAMP, sub_series_id = $1 WHERE id = $2',
							[subSeriesId, rule.id]
						);
					} else {
						// Different series → reset to 1
						await execute(
							'UPDATE categorization_rules SET series_id = $1, sub_series_id = $2, match_count = 1, last_used = CURRENT_TIMESTAMP WHERE id = $3',
							[seriesId, subSeriesId, rule.id]
						);
					}
				} else {
					// New rule
					await execute(
						`INSERT INTO categorization_rules (label_exact, label_normalized, account_id, sign, series_id, sub_series_id, match_count)
						 VALUES ($1, $2, $3, $4, $5, $6, 1)`,
						[labelExact, labelNorm, tx.account_id, sign, seriesId, subSeriesId]
					);
				}
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
