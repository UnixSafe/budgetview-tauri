/**
 * Décalage de mois budgétaire (feature "shift" du BudgetView original).
 * Une transaction peut être comptée dans le budget d'un autre mois que celui
 * de sa date bancaire (ex. salaire versé le 30/05 → budget de juin).
 * En base : transactions.budget_date (NULL = utiliser la date réelle).
 */

function daysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

/** Décale une date ISO (YYYY-MM-DD) d'un mois, en clampant le jour à la fin du mois cible. */
export function shiftDateByMonth(date: string, direction: 1 | -1): string {
	const [y, m, d] = date.split('-').map(Number);
	let year = y;
	let month = m + direction;
	if (month === 0) {
		month = 12;
		year--;
	} else if (month === 13) {
		month = 1;
		year++;
	}
	const day = Math.min(d, daysInMonth(year, month));
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Mois budgétaire effectif (YYYY-MM) : budget_date si décalée, sinon la date réelle. */
export function effectiveBudgetMonth(tx: { date: string; budget_date?: string | null }): string {
	return (tx.budget_date ?? tx.date).slice(0, 7);
}

/** true si la transaction est comptée dans un autre mois que celui de sa date bancaire. */
export function isShiftedToOtherMonth(tx: { date: string; budget_date?: string | null }): boolean {
	return tx.budget_date != null && tx.budget_date.slice(0, 7) !== tx.date.slice(0, 7);
}
