import { query } from '$lib/stores/db';

export interface PotentialDuplicate {
	id: number;
	date: string;
	label: string;
	amount: number;
	account_name: string | null;
}

/**
 * Check for potential duplicate transactions.
 * Looks for transactions with similar date, amount, and label.
 */
export async function findPotentialDuplicates(
	date: string,
	amount: number, // in cents
	label: string,
	accountId: number,
	excludeId?: number
): Promise<PotentialDuplicate[]> {
	const normalizedLabel = label.toUpperCase().trim();

	// Look for transactions within 3 days, same account, same amount
	let sql = `
		SELECT t.id, t.date, t.label, t.amount, a.name as account_name
		FROM transactions t
		LEFT JOIN accounts a ON t.account_id = a.id
		WHERE t.account_id = $1
		  AND t.amount = $2
		  AND ABS(julianday(t.date) - julianday($3)) <= 3
	`;
	const params: unknown[] = [accountId, amount, date];

	if (excludeId) {
		sql += ` AND t.id != $4`;
		params.push(excludeId);
	}

	sql += ` ORDER BY t.date DESC LIMIT 5`;

	return query<PotentialDuplicate>(sql, params);
}
