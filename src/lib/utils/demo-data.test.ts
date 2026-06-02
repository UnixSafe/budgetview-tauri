import { afterEach, describe, expect, it, vi } from 'vitest';

describe('demo data', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
		vi.resetModules();
	});

	it('defines coherent accounts and budget series', async () => {
		const { DEMO_ACCOUNTS, DEMO_SERIES } = await import('./demo-data');

		expect(DEMO_ACCOUNTS).toEqual([
			{ name: 'Compte courant', account_type: 'checking', bank_name: 'Banque Démo', initial_balance: 250000 },
			{ name: 'Livret A', account_type: 'savings', bank_name: 'Banque Démo', initial_balance: 800000 }
		]);
		expect(DEMO_SERIES.map((series) => series.name)).toContain('Salaire');
		expect(DEMO_SERIES.every((series) => Number.isInteger(series.target_amount))).toBe(true);
	});

	it('generates three months of transactions including optional health expenses', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-24T12:00:00Z'));
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
		vi.resetModules();

		const { DEMO_TRANSACTIONS } = await import('./demo-data');

		expect(DEMO_TRANSACTIONS).toHaveLength(57);
		expect(DEMO_TRANSACTIONS[0]).toEqual(
			expect.objectContaining({
				account_index: 0,
				date: '2026-02-01',
				label: 'VIR SEPA ENTREPRISE SALAIRE',
				series_index: 0
			})
		);
		expect(DEMO_TRANSACTIONS.some((tx) => tx.label === 'CB PHARMACIE')).toBe(true);
		expect(DEMO_TRANSACTIONS.filter((tx) => tx.account_index === 1)).toHaveLength(3);
	});

	it('generates demo transactions when optional health expenses are skipped', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-24T12:00:00Z'));
		vi.spyOn(Math, 'random').mockReturnValue(0.1);
		vi.resetModules();

		const { DEMO_TRANSACTIONS } = await import('./demo-data');

		expect(DEMO_TRANSACTIONS).toHaveLength(51);
		expect(DEMO_TRANSACTIONS.some((tx) => tx.label === 'CB PHARMACIE')).toBe(false);
		expect(DEMO_TRANSACTIONS.every((tx) => /^\d{4}-\d{2}-\d{2}$/.test(tx.date))).toBe(true);
	});
});
