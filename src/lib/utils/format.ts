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
 * Anonymize a transaction label for auto-categorization matching.
 * Removes date patterns (DD/MM, DD/MM/YYYY) and long purely-digit words (4+ digits: card numbers,
 * check numbers, references). Keeps mixed alphanumeric words (3SUISSES, LIDL2GO, PARIS13)
 * and short numbers.
 * Example: 'CARTE 17/03 CARREFOUR CB*1234 5678' → 'CARTE CARREFOUR CB*1234'
 */
export function anonymizeLabel(label: string): string {
	return label
		.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, '') // remove date patterns DD/MM or DD/MM/YYYY
		.split(/\s+/)
		.filter((word) => word.length > 0 && !/^\d{4,}$/.test(word)) // remove purely-digit words 4+ chars (card/check/ref numbers)
		.join(' ')
		.trim()
		.toUpperCase();
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

/**
 * Detect if a transaction label looks like a transfer between accounts.
 * Common French patterns: VIR SEPA, VIREMENT, VIR EMIS, VIR RECU
 */
export function isTransferLabel(label: string): boolean {
	const lower = label.toLowerCase();
	return /\b(vir(ement)?(\s+(sepa|emis|recu|interne))?|transfert|mouvement\s+interne)\b/.test(lower);
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
	card: 'Carte',
	transfer: 'Virement',
	direct_debit: 'Prélèvement',
	check: 'Chèque',
	cash_withdrawal: 'Retrait',
	cash_deposit: 'Dépôt espèces',
	fee: 'Frais',
	refund: 'Remboursement',
	income: 'Revenu',
	other: 'Autre'
};

export function detectTransactionType(label: string, amountCents: number): string {
	const lower = label.toLowerCase();
	if (/\b(cheque|chèque|chq)\b/.test(lower)) return 'check';
	if (/\b(retrait|dab|gab)\b/.test(lower)) return 'cash_withdrawal';
	if (/\b(depot\s*esp|dépôt\s*esp|remise\s*esp|versement\s*esp)\b/.test(lower)) return 'cash_deposit';
	if (/\b(prlv|prelevement|prélèvement)\b/.test(lower)) return 'direct_debit';
	if (isTransferLabel(label)) return 'transfer';
	if (/\b(cb|carte)\b/.test(lower)) return 'card';
	if (/\b(frais|commission)\b/.test(lower)) return 'fee';
	if (/\b(remb|remboursement|refund)\b/.test(lower)) return 'refund';
	if (amountCents > 0) return 'income';
	return 'other';
}

export const BUDGET_AREA_COLORS: Record<string, string> = {
	income: 'text-income',
	recurring: 'text-accent',
	variable: 'text-warning',
	extras: 'text-text-secondary',
	savings: 'text-income',
	transfers: 'text-accent'
};
