const currencyFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatCurrency(amount: number): string {
	return currencyFmt.format(amount);
}

export function formatDate(date: string): string {
	return dateFmt.format(new Date(date));
}

export function formatMonth(year: number, month: number): string {
	return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
		new Date(year, month - 1)
	);
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
