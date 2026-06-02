import { query, execute } from './db';
import type { Transaction } from '$lib/types';
import { toCents, anonymizeLabel, isExcludedFromAutoCategorization } from '$lib/utils/format';
import { categorizationStore } from './categorization.svelte';
import { undoStore } from './undo.svelte';

const PAGE_SIZE = 200;

export type TransactionCategorizationFilter = '' | 'categorized' | 'uncategorized';
export type TransactionReconciledFilter = '' | 'yes' | 'no';

export interface TransactionFilters {
	accountId: number | string;
	seriesId: number | string;
	search: string;
	dateFrom: string;
	dateTo: string;
	amountMin: string;
	amountMax: string;
	categorization: TransactionCategorizationFilter;
	reconciled: TransactionReconciledFilter;
}

function parseAmountFilter(value: string): number | null {
	const normalized = value.trim().replace(',', '.');
	if (!normalized) return null;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? toCents(parsed) : null;
}

export function buildTransactionWhere(filters: TransactionFilters): { clause: string; params: unknown[] } {
	let clause = ' WHERE 1=1';
	const params: unknown[] = [];
	let i = 1;

	if (filters.accountId) {
		clause += ` AND t.account_id = $${i++}`;
		params.push(filters.accountId);
	}
	if (filters.seriesId) {
		clause += ` AND t.series_id = $${i++}`;
		params.push(filters.seriesId);
	}
	if (filters.search) {
		clause += ` AND t.label LIKE $${i++}`;
		params.push(`%${filters.search}%`);
	}
	if (filters.dateFrom) {
		clause += ` AND t.date >= $${i++}`;
		params.push(filters.dateFrom);
	}
	if (filters.dateTo) {
		clause += ` AND t.date <= $${i++}`;
		params.push(filters.dateTo);
	}

	const amountMin = parseAmountFilter(filters.amountMin);
	if (amountMin !== null) {
		clause += ` AND t.amount >= $${i++}`;
		params.push(amountMin);
	}

	const amountMax = parseAmountFilter(filters.amountMax);
	if (amountMax !== null) {
		clause += ` AND t.amount <= $${i++}`;
		params.push(amountMax);
	}

	if (filters.categorization === 'categorized') {
		clause += ' AND t.series_id IS NOT NULL';
	} else if (filters.categorization === 'uncategorized') {
		clause += ' AND t.series_id IS NULL';
	}

	if (filters.reconciled === 'yes') {
		clause += ' AND t.is_reconciled = 1';
	} else if (filters.reconciled === 'no') {
		clause += ' AND COALESCE(t.is_reconciled, 0) = 0';
	}

	return { clause, params };
}

class TransactionStore {
	transactions = $state<Transaction[]>([]);
	loading = $state(false);
	loadingMore = $state(false);
	hasMore = $state(false);
	totalCount = $state(0);
	error = $state<string | null>(null);
	search = $state('');
	filterAccountId = $state<number | string>('');
	filterSeriesId = $state<number | string>('');
	filterDateFrom = $state('');
	filterDateTo = $state('');
	filterAmountMin = $state('');
	filterAmountMax = $state('');
	filterCategorization = $state<TransactionCategorizationFilter>('');
	filterReconciled = $state<TransactionReconciledFilter>('');

	private buildWhere(): { clause: string; params: unknown[] } {
		return buildTransactionWhere({
			accountId: this.filterAccountId,
			seriesId: this.filterSeriesId,
			search: this.search,
			dateFrom: this.filterDateFrom,
			dateTo: this.filterDateTo,
			amountMin: this.filterAmountMin,
			amountMax: this.filterAmountMax,
			categorization: this.filterCategorization,
			reconciled: this.filterReconciled
		});
	}

	async load() {
		this.loading = true;
		this.error = null;
		try {
			const { clause, params } = this.buildWhere();

			const countResult = await query<{ count: number }>(
				`SELECT COUNT(*) as count FROM transactions t${clause}`, params
			);
			this.totalCount = countResult[0]?.count ?? 0;

			const sql = `
				SELECT t.*, a.name as account_name, bs.name as series_name, ss.name as sub_series_name
				FROM transactions t
				LEFT JOIN accounts a ON t.account_id = a.id
				LEFT JOIN budget_series bs ON t.series_id = bs.id
				LEFT JOIN sub_series ss ON t.sub_series_id = ss.id
				${clause}
				ORDER BY t.date DESC, t.id DESC
				LIMIT ${PAGE_SIZE}
			`;

			this.transactions = await query<Transaction>(sql, params);
			this.hasMore = this.transactions.length < this.totalCount;
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Erreur inconnue';
		} finally {
			this.loading = false;
		}
	}

	async loadMore() {
		if (!this.hasMore || this.loadingMore) return;
		this.loadingMore = true;
		try {
			const { clause, params } = this.buildWhere();
			const offset = this.transactions.length;

			const sql = `
				SELECT t.*, a.name as account_name, bs.name as series_name, ss.name as sub_series_name
				FROM transactions t
				LEFT JOIN accounts a ON t.account_id = a.id
				LEFT JOIN budget_series bs ON t.series_id = bs.id
				LEFT JOIN sub_series ss ON t.sub_series_id = ss.id
				${clause}
				ORDER BY t.date DESC, t.id DESC
				LIMIT ${PAGE_SIZE} OFFSET ${offset}
			`;

			const more = await query<Transaction>(sql, params);
			this.transactions = [...this.transactions, ...more];
			this.hasMore = this.transactions.length < this.totalCount;
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Erreur inconnue';
		} finally {
			this.loadingMore = false;
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
		// Save previous state for undo
		const tx = this.transactions.find((t) => t.id === transactionId);
		const prevSeriesId = tx?.series_id ?? null;
		const prevSubSeriesId = tx?.sub_series_id ?? null;

		await execute(
			'UPDATE transactions SET series_id = $1, sub_series_id = $2, is_auto_categorized = 0 WHERE id = $3',
			[seriesId, subSeriesId, transactionId]
		);

		// Push undo action
		undoStore.push({
			label: `Catégorisation de "${tx?.label ?? 'transaction'}"`,
			undo: async () => {
				await execute(
					'UPDATE transactions SET series_id = $1, sub_series_id = $2 WHERE id = $3',
					[prevSeriesId, prevSubSeriesId, transactionId]
				);
				await this.load();
			}
		});

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

	/**
	 * Batch categorize multiple transactions at once.
	 */
	async batchCategorize(transactionIds: number[], seriesId: number | null, subSeriesId: number | null = null): Promise<number> {
		if (transactionIds.length === 0) return 0;

		// Use placeholders for batch update
		for (const id of transactionIds) {
			await execute(
				'UPDATE transactions SET series_id = $1, sub_series_id = $2, is_auto_categorized = 0 WHERE id = $3',
				[seriesId, subSeriesId, id]
			);

			// Learn patterns for auto-categorization
			if (seriesId !== null) {
				const tx = this.transactions.find((t) => t.id === id);
				if (tx && !isExcludedFromAutoCategorization(tx.original_label ?? tx.label)) {
					await categorizationStore.learn(tx, seriesId, subSeriesId);
				}
			}
		}

		await this.load();
		return transactionIds.length;
	}

	async remove(id: number) {
		// Save for undo
		const tx = this.transactions.find((t) => t.id === id);

		await execute('DELETE FROM transactions WHERE id = $1', [id]);

		if (tx) {
			undoStore.push({
				label: `Suppression de "${tx.label}"`,
				undo: async () => {
					await execute(
						'INSERT INTO transactions (account_id, date, label, original_label, amount, note, series_id, sub_series_id, label_for_categorization) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
						[tx.account_id, tx.date, tx.label, tx.original_label, tx.amount, tx.note, tx.series_id, tx.sub_series_id, tx.label_for_categorization]
					);
					await this.load();
				}
			});
		}

		await this.load();
	}
}

export const transactionStore = new TransactionStore();
