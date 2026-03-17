const currencyFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Format an amount stored in centimes as EUR currency */
export function formatCurrency(cents: number): string {
	return currencyFmt.format(cents / 100);
}

/** Convert euros to centimes for DB storage */
export function toCents(euros: number): number {
	return Math.round(euros * 100);
}

/** Convert centimes to euros for display in form inputs */
export function toEuros(cents: number): number {
	return cents / 100;
}

export function formatDate(date: string): string {
	return dateFmt.format(new Date(date));
}

export function formatMonth(year: number, month: number): string {
	return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
		new Date(year, month - 1)
	);
}

/**
 * Normalize a transaction label for auto-categorization matching.
 * Removes variable parts (dates, check numbers, card numbers, references),
 * lowercases, and trims. Example: 'CARREFOUR 15/03 CB1234' → 'carrefour cb'
 */
export function normalizeLabel(label: string): string {
	return label
		.toLowerCase()
		// Remove dates (DD/MM, DD/MM/YY, DD/MM/YYYY, DD-MM-YYYY, DDMMYY, YYYYMMDD)
		.replace(/\b\d{1,2}[/\-.]\d{1,2}([/\-.]\d{2,4})?\b/g, '')
		.replace(/\b\d{4}\d{2}\d{2}\b/g, '')
		.replace(/\b\d{2}\d{2}\d{2}\b/g, '')
		// Remove long number sequences (card numbers, references, check numbers: 4+ digits)
		.replace(/\b\d{4,}\b/g, '')
		// Remove isolated 1-3 digit numbers (amounts, short refs) but keep words with digits like "cb"
		.replace(/\b\d{1,3}\b/g, '')
		// Remove extra whitespace
		.replace(/\s+/g, ' ')
		.trim();
}

/** Check if a transaction label looks like a check, cash withdrawal, or cash deposit */
export function isExcludedFromAutoCategorization(label: string): boolean {
	const lower = label.toLowerCase();
	return /\b(cheque|chèque|chq|retrait\s*(dab|gab)?|remise\s*esp|depot\s*esp|versement\s*esp)\b/.test(lower);
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
	checking: 'Compte courant',
	savings: "Livret d'épargne",
	credit_card: 'Carte de crédit',
	cash: 'Espèces'
};

export const BUDGET_AREA_LABELS: Record<string, string> = {
	income: 'Revenus',
	recurring: 'Dépenses fixes',
	variable: 'Dépenses variables',
	extras: 'Extras',
	savings: 'Épargne',
	transfers: 'Virements'
};

export const BUDGET_AREA_COLORS: Record<string, string> = {
	income: 'text-income',
	recurring: 'text-accent',
	variable: 'text-warning',
	extras: 'text-text-secondary',
	savings: 'text-income',
	transfers: 'text-accent'
};
