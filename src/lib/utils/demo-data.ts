/**
 * Demo dataset for new users to explore the app before entering real data.
 * Inspired by BudgetView Java's GotoDemoAccountAction.
 */

export interface DemoAccount {
	name: string;
	account_type: string;
	bank_name: string;
	initial_balance: number; // in cents
}

export interface DemoSeries {
	name: string;
	budget_area: string;
	target_amount: number; // in cents (negative for expenses)
}

export interface DemoTransaction {
	account_index: number; // index into accounts array
	date: string;
	label: string;
	amount: number; // in cents
	series_index: number | null; // index into series array
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
	{ name: 'Compte courant', account_type: 'checking', bank_name: 'Banque Démo', initial_balance: 250000 },
	{ name: 'Livret A', account_type: 'savings', bank_name: 'Banque Démo', initial_balance: 800000 },
];

export const DEMO_SERIES: DemoSeries[] = [
	// Income
	{ name: 'Salaire', budget_area: 'income', target_amount: 280000 },
	// Recurring
	{ name: 'Loyer', budget_area: 'recurring', target_amount: -85000 },
	{ name: 'Électricité', budget_area: 'recurring', target_amount: -7500 },
	{ name: 'Internet & Mobile', budget_area: 'recurring', target_amount: -5000 },
	{ name: 'Assurances', budget_area: 'recurring', target_amount: -12000 },
	{ name: 'Transport', budget_area: 'recurring', target_amount: -7500 },
	// Variable
	{ name: 'Courses alimentaires', budget_area: 'variable', target_amount: -40000 },
	{ name: 'Restaurants', budget_area: 'variable', target_amount: -15000 },
	{ name: 'Loisirs', budget_area: 'variable', target_amount: -10000 },
	{ name: 'Santé', budget_area: 'variable', target_amount: -5000 },
	{ name: 'Vêtements', budget_area: 'variable', target_amount: -8000 },
	// Savings
	{ name: 'Épargne mensuelle', budget_area: 'savings', target_amount: -20000 },
];

function generateDemoTransactions(): DemoTransaction[] {
	const txs: DemoTransaction[] = [];
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth();

	// Generate 3 months of transactions
	for (let monthOffset = -2; monthOffset <= 0; monthOffset++) {
		const m = new Date(currentYear, currentMonth + monthOffset, 1);
		const year = m.getFullYear();
		const month = m.getMonth();

		// Salary (1st of month)
		txs.push({
			account_index: 0, date: `${year}-${String(month + 1).padStart(2, '0')}-01`,
			label: 'VIR SEPA ENTREPRISE SALAIRE', amount: 280000 + Math.round((Math.random() - 0.5) * 10000),
			series_index: 0
		});

		// Rent (5th)
		txs.push({
			account_index: 0, date: `${year}-${String(month + 1).padStart(2, '0')}-05`,
			label: 'PRLV SEPA IMMOBILIER LOYER', amount: -85000,
			series_index: 1
		});

		// Electricity (10th)
		txs.push({
			account_index: 0, date: `${year}-${String(month + 1).padStart(2, '0')}-10`,
			label: 'PRLV SEPA EDF', amount: -7500 + Math.round((Math.random() - 0.5) * 2000),
			series_index: 2
		});

		// Internet (12th)
		txs.push({
			account_index: 0, date: `${year}-${String(month + 1).padStart(2, '0')}-12`,
			label: 'PRLV SEPA FREE MOBILE', amount: -4990,
			series_index: 3
		});

		// Insurance (15th)
		txs.push({
			account_index: 0, date: `${year}-${String(month + 1).padStart(2, '0')}-15`,
			label: 'PRLV SEPA MAIF ASSURANCE', amount: -12000,
			series_index: 4
		});

		// Transport (various)
		txs.push({
			account_index: 0, date: `${year}-${String(month + 1).padStart(2, '0')}-03`,
			label: 'PRLV SEPA NAVIGO', amount: -7500,
			series_index: 5
		});

		// Groceries (multiple times per month)
		const groceryLabels = ['CARREFOUR', 'LIDL', 'MONOPRIX', 'AUCHAN', 'INTERMARCHE'];
		for (let i = 0; i < 6; i++) {
			const day = 3 + Math.floor(Math.random() * 25);
			const label = groceryLabels[Math.floor(Math.random() * groceryLabels.length)];
			txs.push({
				account_index: 0,
				date: `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(day, 28)).padStart(2, '0')}`,
				label: `CB ${label}`,
				amount: -(3000 + Math.round(Math.random() * 7000)),
				series_index: 6
			});
		}

		// Restaurants (2-3 per month)
		const restoLabels = ['RESTAURANT LE BISTROT', 'MCDONALDS', 'SUSHI SHOP', 'PIZZA HUT'];
		for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
			const day = 5 + Math.floor(Math.random() * 22);
			txs.push({
				account_index: 0,
				date: `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(day, 28)).padStart(2, '0')}`,
				label: `CB ${restoLabels[Math.floor(Math.random() * restoLabels.length)]}`,
				amount: -(1500 + Math.round(Math.random() * 3500)),
				series_index: 7
			});
		}

		// Leisure
		txs.push({
			account_index: 0,
			date: `${year}-${String(month + 1).padStart(2, '0')}-${String(15 + Math.floor(Math.random() * 10)).padStart(2, '0')}`,
			label: 'CB FNAC',
			amount: -(2000 + Math.round(Math.random() * 5000)),
			series_index: 8
		});

		// Health (once per month)
		if (Math.random() > 0.3) {
			txs.push({
				account_index: 0,
				date: `${year}-${String(month + 1).padStart(2, '0')}-${String(10 + Math.floor(Math.random() * 15)).padStart(2, '0')}`,
				label: 'CB PHARMACIE',
				amount: -(1500 + Math.round(Math.random() * 3000)),
				series_index: 9
			});
		}

		// Savings transfer (25th)
		txs.push({
			account_index: 0,
			date: `${year}-${String(month + 1).padStart(2, '0')}-25`,
			label: 'VIR EPARGNE MENSUELLE',
			amount: -20000,
			series_index: 11
		});
		txs.push({
			account_index: 1,
			date: `${year}-${String(month + 1).padStart(2, '0')}-25`,
			label: 'VIR EPARGNE MENSUELLE',
			amount: 20000,
			series_index: null
		});
	}

	return txs;
}

export const DEMO_TRANSACTIONS = generateDemoTransactions();
