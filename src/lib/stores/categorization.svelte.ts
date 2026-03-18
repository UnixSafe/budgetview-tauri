import { query, execute } from './db';
import type { CategorizationRule, Transaction } from '$lib/types';
import { anonymizeLabel } from '$lib/utils/format';

class CategorizationStore {
	rules = $state<CategorizationRule[]>([]);
	loading = $state(false);

	async load() {
		this.loading = true;
		try {
			this.rules = await query<CategorizationRule>(
				`SELECT cr.*, bs.name as series_name
				 FROM categorization_rules cr
				 LEFT JOIN budget_series bs ON cr.series_id = bs.id
				 ORDER BY cr.match_count DESC`
			);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Learn from a user's manual categorization.
	 * Upserts a rule: if same label_pattern exists with same series → increment,
	 * if different series → reset to 1 with new series.
	 */
	async learn(transaction: Transaction, seriesId: number, subSeriesId: number | null = null) {
		const labelPattern = anonymizeLabel(transaction.original_label ?? transaction.label);
		if (!labelPattern) return;

		// Check if rule exists
		const existing = await query<{ id: number; series_id: number }>(
			'SELECT id, series_id FROM categorization_rules WHERE label_pattern = $1',
			[labelPattern]
		);

		if (existing.length > 0) {
			const rule = existing[0];
			if (rule.series_id === seriesId) {
				// Same series → increment
				await execute(
					'UPDATE categorization_rules SET match_count = match_count + 1, last_used_at = CURRENT_TIMESTAMP, sub_series_id = $1 WHERE id = $2',
					[subSeriesId, rule.id]
				);
			} else {
				// Different series → reset
				await execute(
					'UPDATE categorization_rules SET series_id = $1, sub_series_id = $2, match_count = 1, last_used_at = CURRENT_TIMESTAMP WHERE id = $3',
					[seriesId, subSeriesId, rule.id]
				);
			}
		} else {
			// New rule
			await execute(
				'INSERT INTO categorization_rules (label_pattern, series_id, sub_series_id) VALUES ($1, $2, $3)',
				[labelPattern, seriesId, subSeriesId]
			);
		}
	}

	/**
	 * Find all uncategorized transactions with the same anonymized label.
	 */
	async findSimilarUncategorized(transaction: Transaction): Promise<Transaction[]> {
		const labelPattern = anonymizeLabel(transaction.original_label ?? transaction.label);
		if (!labelPattern) return [];

		return await query<Transaction>(
			`SELECT t.*, a.name as account_name, bs.name as series_name
			 FROM transactions t
			 LEFT JOIN accounts a ON t.account_id = a.id
			 LEFT JOIN budget_series bs ON t.series_id = bs.id
			 WHERE t.label_for_categorization = $1 AND t.series_id IS NULL AND t.id != $2`,
			[labelPattern, transaction.id]
		);
	}

	/**
	 * Apply a category to all transactions with the same anonymized label.
	 * Returns the number of transactions updated.
	 */
	async applyToSimilar(
		transaction: Transaction,
		seriesId: number,
		subSeriesId: number | null = null
	): Promise<number> {
		const labelPattern = anonymizeLabel(transaction.original_label ?? transaction.label);
		if (!labelPattern) return 0;

		const result = await execute(
			`UPDATE transactions SET series_id = $1, sub_series_id = $2, is_auto_categorized = 0
			 WHERE label_for_categorization = $3 AND series_id IS NULL AND id != $4`,
			[seriesId, subSeriesId, labelPattern, transaction.id]
		);

		return result?.rowsAffected ?? 0;
	}

	/**
	 * Update the series assigned to a categorization rule.
	 */
	async updateRule(ruleId: number, seriesId: number) {
		await execute(
			'UPDATE categorization_rules SET series_id = $1, last_used_at = CURRENT_TIMESTAMP WHERE id = $2',
			[seriesId, ruleId]
		);
		await this.load();
	}

	/**
	 * Delete a categorization rule.
	 */
	async remove(id: number) {
		await execute('DELETE FROM categorization_rules WHERE id = $1', [id]);
		await this.load();
	}

	/**
	 * Backfill label_for_categorization on existing transactions that have a NULL value.
	 * Must be called once after migration 003.
	 */
	async backfillLabels() {
		const rows = await query<{ id: number; label: string; original_label: string | null }>(
			'SELECT id, label, original_label FROM transactions WHERE label_for_categorization IS NULL'
		);
		for (const row of rows) {
			const labelAnon = anonymizeLabel(row.original_label ?? row.label);
			await execute(
				'UPDATE transactions SET label_for_categorization = $1 WHERE id = $2',
				[labelAnon, row.id]
			);
		}
	}
}

export const categorizationStore = new CategorizationStore();
