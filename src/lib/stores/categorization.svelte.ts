import { query, execute } from './db';
import type { CategorizationRule, Transaction } from '$lib/types';

/**
 * Normalize a label for fuzzy matching:
 * - uppercase
 * - remove sequences of 4+ digits (card numbers, references)
 * - collapse whitespace
 */
export function normalizeLabel(label: string): string {
	return label
		.toUpperCase()
		.replace(/\d{4,}/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

class CategorizationStore {
	rules = $state<CategorizationRule[]>([]);
	loading = $state(false);

	async load() {
		this.loading = true;
		try {
			this.rules = await query<CategorizationRule>(
				`SELECT cr.*, bs.name as series_name, a.name as account_name
				 FROM categorization_rules cr
				 LEFT JOIN budget_series bs ON cr.series_id = bs.id
				 LEFT JOIN accounts a ON cr.account_id = a.id
				 ORDER BY cr.match_count DESC`
			);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Learn from a user's manual categorization.
	 * Creates or updates a rule based on the transaction's label.
	 */
	async learn(transaction: Transaction, seriesId: number, subSeriesId: number | null = null) {
		const labelExact = (transaction.original_label ?? transaction.label).toUpperCase().trim();
		const labelNormalized = normalizeLabel(transaction.original_label ?? transaction.label);
		const sign = transaction.amount >= 0 ? 1 : -1;
		const accountId = transaction.account_id;

		await execute(
			`INSERT INTO categorization_rules (label_exact, label_normalized, account_id, sign, series_id, sub_series_id, match_count, last_used)
			 VALUES ($1, $2, $3, $4, $5, $6, 1, CURRENT_TIMESTAMP)
			 ON CONFLICT(label_exact, account_id, sign) DO UPDATE SET
			 series_id = $5, sub_series_id = $6, match_count = match_count + 1, last_used = CURRENT_TIMESTAMP`,
			[labelExact, labelNormalized, accountId, sign, seriesId, subSeriesId]
		);

		// Also clear is_auto_categorized flag since user manually chose
		await execute(
			'UPDATE transactions SET is_auto_categorized = 0 WHERE id = $1',
			[transaction.id]
		);
	}

	/**
	 * Suggest a series for a transaction based on existing rules.
	 * Returns the best matching rule, or null if no match.
	 * Uses the same 4-level matching as the Rust backend.
	 */
	suggest(transaction: Transaction): CategorizationRule | null {
		const labelExact = (transaction.original_label ?? transaction.label).toUpperCase().trim();
		const labelNormalized = normalizeLabel(transaction.original_label ?? transaction.label);
		const sign = transaction.amount >= 0 ? 1 : -1;
		const accountId = transaction.account_id;

		// Level 1: exact + same sign + same account
		for (const rule of this.rules) {
			if (rule.account_id === accountId && rule.sign === sign && rule.label_exact === labelExact) {
				return rule;
			}
		}

		// Level 2: exact + same account (any sign)
		for (const rule of this.rules) {
			if (rule.account_id === accountId && rule.label_exact === labelExact) {
				return rule;
			}
		}

		// Level 3: normalized + same sign + same account
		for (const rule of this.rules) {
			if (rule.account_id === accountId && rule.sign === sign && rule.label_normalized === labelNormalized) {
				return rule;
			}
		}

		// Level 4: normalized + same account (any sign)
		for (const rule of this.rules) {
			if (rule.account_id === accountId && rule.label_normalized === labelNormalized) {
				return rule;
			}
		}

		return null;
	}

	/**
	 * Auto-apply rules to a list of uncategorized transactions.
	 * Only applies rules with match_count >= 3 (high confidence).
	 * Returns the number of transactions auto-categorized.
	 */
	async autoApply(transactions: Transaction[]): Promise<number> {
		let count = 0;

		for (const tx of transactions) {
			if (tx.series_id !== null) continue; // already categorized

			const rule = this.suggest(tx);
			if (rule && rule.match_count >= 3) {
				await execute(
					'UPDATE transactions SET series_id = $1, sub_series_id = $2, is_auto_categorized = 1 WHERE id = $3',
					[rule.series_id, rule.sub_series_id, tx.id]
				);
				count++;
			}
		}

		return count;
	}

	/**
	 * Delete a categorization rule.
	 */
	async remove(id: number) {
		await execute('DELETE FROM categorization_rules WHERE id = $1', [id]);
		await this.load();
	}

	/**
	 * Update a rule's series assignment.
	 */
	async updateRule(id: number, seriesId: number, subSeriesId: number | null = null) {
		await execute(
			'UPDATE categorization_rules SET series_id = $1, sub_series_id = $2 WHERE id = $3',
			[seriesId, subSeriesId, id]
		);
		await this.load();
	}
}

export const categorizationStore = new CategorizationStore();
