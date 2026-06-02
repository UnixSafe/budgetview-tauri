import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '$lib/types';

vi.mock('./db', () => ({
	query: vi.fn(),
	execute: vi.fn()
}));

import { query, execute } from './db';
import { AccountStore } from './accounts.svelte';
import { BudgetStore } from './budget.svelte';
import { CategorizationStore } from './categorization.svelte';
import { ConfidentialStore } from './confidential.svelte';
import { NotesStore } from './notes.svelte';
import { ProjectStore } from './projects.svelte';

const queryMock = vi.mocked(query);
const executeMock = vi.mocked(execute);

function tx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: 1,
		account_id: 1,
		date: '2026-03-17',
		label: 'CARREFOUR 123456',
		original_label: null,
		amount: -4200,
		note: null,
		is_planned: false,
		series_id: null,
		sub_series_id: null,
		import_batch_id: null,
		fitid: null,
		created_at: '2026-03-17',
		label_for_categorization: 'CARREFOUR',
		is_auto_categorized: false,
		is_reconciled: false,
		...overrides
	};
}

describe('AccountStore', () => {
	beforeEach(() => {
		queryMock.mockReset();
		executeMock.mockReset();
	});

	it('loads active accounts with balances and exposes totals/alerts', async () => {
		const store = new AccountStore();
		queryMock.mockResolvedValueOnce([
			{ id: 1, name: 'Compte courant', computed_balance: 1000, low_balance_enabled: 0, low_balance_threshold: null },
			{ id: 2, name: 'Livret', computed_balance: 500, low_balance_enabled: 1, low_balance_threshold: 600 }
		]);

		await store.load();

		expect(store.loading).toBe(false);
		expect(store.error).toBeNull();
		expect(store.totalBalance).toBe(1500);
		expect(store.getBalance(store.accounts[0])).toBe(1000);
		expect(store.lowBalanceAlerts.map((account) => account.id)).toEqual([2]);
	});

	it('records load errors and clears loading', async () => {
		const store = new AccountStore();
		queryMock.mockRejectedValueOnce(new Error('db down'));

		await store.load();

		expect(store.error).toBe('db down');
		expect(store.loading).toBe(false);

		queryMock.mockRejectedValueOnce('raw failure');
		await store.load();
		expect(store.error).toBe('Erreur inconnue');
	});

	it('creates accounts in centimes and falls back to querying the inserted id', async () => {
		const store = new AccountStore();
		executeMock.mockResolvedValueOnce({ rowsAffected: 1 });
		queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 12 }]);

		const id = await store.create({ name: 'Cash', account_type: 'cash', initial_balance: 12.34 });

		expect(executeMock).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining('INSERT INTO accounts'),
			['Cash', null, null, 'cash', 1234]
		);
		expect(id).toBe(12);

		executeMock.mockResolvedValueOnce({ rowsAffected: 1 });
		queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
		await expect(store.create({ name: 'No id', account_type: 'cash', initial_balance: 0 })).resolves.toBe(0);
	});

	it('returns lastInsertId directly when available', async () => {
		const store = new AccountStore();
		executeMock.mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 99 });
		queryMock.mockResolvedValueOnce([]);

		await expect(store.create({ name: 'Direct', account_type: 'checking', initial_balance: 1 })).resolves.toBe(99);
	});

	it('updates only whitelisted defined fields and converts initial balance', async () => {
		const store = new AccountStore();
		queryMock.mockResolvedValueOnce([]);

		await store.update(7, {
			name: 'Nouveau',
			initial_balance: 10,
			bank_name: undefined,
			// @ts-expect-error invalid keys can still be supplied at runtime
			unsafe_column: 'DROP'
		});

		expect(executeMock).toHaveBeenCalledWith(
			'UPDATE accounts SET name = $1, initial_balance = $2 WHERE id = $3',
			['Nouveau', 1000, 7]
		);
	});

	it('skips empty updates, removes accounts and persists thresholds', async () => {
		const store = new AccountStore();
		queryMock.mockResolvedValue([]);

		await store.update(1, {});
		expect(executeMock).not.toHaveBeenCalled();

		await store.remove(1);
		await store.setThreshold(1, 500, true);
		await store.setThreshold(1, null, false);

		expect(executeMock).toHaveBeenCalledWith('UPDATE accounts SET is_active = 0 WHERE id = $1', [1]);
		expect(executeMock).toHaveBeenCalledWith(
			'UPDATE accounts SET low_balance_threshold = $1, low_balance_enabled = $2 WHERE id = $3',
			[500, 1, 1]
		);
		expect(executeMock).toHaveBeenCalledWith(
			'UPDATE accounts SET low_balance_threshold = $1, low_balance_enabled = $2 WHERE id = $3',
			[null, 0, 1]
		);
	});
});

describe('BudgetStore', () => {
	beforeEach(() => {
		queryMock.mockReset();
		executeMock.mockReset();
	});

	it('loads series, sub-series and groups', async () => {
		const store = new BudgetStore();
		queryMock
			.mockResolvedValueOnce([{ id: 1, name: 'Courses', budget_area: 'variable', target_amount: 1000 }])
			.mockResolvedValueOnce([{ id: 2, series_id: 1, name: 'Drive' }])
			.mockResolvedValueOnce([{ id: 3, name: 'Maison', is_expanded: 1 }]);

		await store.loadSeries();

		expect(store.series).toHaveLength(1);
		expect(store.getSubSeries(1).map((sub) => sub.name)).toEqual(['Drive']);
		expect(store.groups[0].name).toBe('Maison');
	});

	it('builds budget lines for the selected month and handles December boundaries', async () => {
		const store = new BudgetStore();
		store.year = 2026;
		store.month = 12;
		queryMock
			.mockResolvedValueOnce([{ id: 1, name: 'Salaire', budget_area: 'income', target_amount: 300000 }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ series_id: 1, planned_amount: 310000 }])
			.mockResolvedValueOnce([{ series_id: 1, total: 305000 }]);

		await store.loadBudgetView();

		expect(queryMock).toHaveBeenLastCalledWith(expect.stringContaining('date >= $1'), ['2026-12-01', '2027-01-01']);
		expect(store.budgetLines).toEqual([
			{ series_id: 1, series_name: 'Salaire', budget_area: 'income', planned_amount: 310000, actual_amount: 305000 }
		]);
		expect(store.totalPlanned).toBe(310000);
		expect(store.totalActual).toBe(305000);
		expect(store.groupedByArea.income).toHaveLength(1);
	});

	it('falls back to target amounts and zero actuals when explicit rows are missing', async () => {
		const store = new BudgetStore();
		queryMock
			.mockResolvedValueOnce([
				{ id: 1, name: 'Courses', budget_area: 'variable', target_amount: 40000 },
				{ id: 2, name: 'Extras', budget_area: 'extras', target_amount: null }
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		await store.loadBudgetView();

		expect(store.budgetLines[0]).toEqual({
			series_id: 1,
			series_name: 'Courses',
			budget_area: 'variable',
			planned_amount: 40000,
			actual_amount: 0
		});
		expect(store.budgetLines[1].planned_amount).toBe(0);
	});

	it('records load errors in budget view', async () => {
		const store = new BudgetStore();
		queryMock.mockRejectedValueOnce(new Error('boom'));

		await store.loadBudgetView();

		expect(store.error).toBe('boom');
		expect(store.loading).toBe(false);

		queryMock.mockRejectedValueOnce('boom');
		await store.loadBudgetView();
		expect(store.error).toBe('Erreur inconnue');
	});

	it('creates, updates, removes series and monthly budgets with cent conversion', async () => {
		const store = new BudgetStore();
		queryMock.mockResolvedValue([]);

		await store.createSeries({ name: 'Loyer', budget_area: 'recurring', target_amount: 800, description: 'Maison' });
		await store.updateSeries(1, {
			name: 'Loyer + charges',
			target_amount: 850,
			description: null,
			// @ts-expect-error runtime whitelist check
			created_at: 'nope'
		});
		await store.removeSeries(1);
		await store.setMonthlyBudget(1, 900);

		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO budget_series'), ['Loyer', 'recurring', 80000, 'Maison']);
		expect(executeMock).toHaveBeenCalledWith(
			'UPDATE budget_series SET name = $1, target_amount = $2, description = $3 WHERE id = $4',
			['Loyer + charges', 85000, null, 1]
		);
		expect(executeMock).toHaveBeenCalledWith('UPDATE budget_series SET is_active = 0 WHERE id = $1', [1]);
		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO monthly_budget'), [1, store.year, store.month, 90000]);

		await store.createSeries({ name: 'Extras', budget_area: 'extras' });
		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO budget_series'), ['Extras', 'extras', null, null]);
	});

	it('skips empty series updates', async () => {
		const store = new BudgetStore();

		await store.updateSeries(1, {});

		expect(executeMock).not.toHaveBeenCalled();
	});

	it('manages sub-series and groups', async () => {
		const store = new BudgetStore();
		queryMock.mockResolvedValue([]);

		await store.createSubSeries(1, 'Supermarché');
		await store.updateSubSeries(2, 'Drive');
		await store.removeSubSeries(2);
		await store.createGroup('Fixes');
		await store.updateGroup(3, 'Charges fixes');
		await store.removeGroup(3);
		await store.assignSeriesToGroup(1, 3);

		expect(executeMock).toHaveBeenCalledWith('INSERT INTO sub_series (series_id, name) VALUES ($1, $2)', [1, 'Supermarché']);
		expect(executeMock).toHaveBeenCalledWith('UPDATE sub_series SET name = $1 WHERE id = $2', ['Drive', 2]);
		expect(executeMock).toHaveBeenCalledWith('DELETE FROM series_groups WHERE id = $1', [3]);
		expect(executeMock).toHaveBeenCalledWith('UPDATE budget_series SET group_id = $1 WHERE id = $2', [3, 1]);
	});

	it('toggles expanded groups only when the group exists', async () => {
		const store = new BudgetStore();
		store.groups = [{ id: 1, name: 'Fixes', is_expanded: true, sort_order: 0 }];

		await store.toggleGroupExpanded(2);
		expect(executeMock).not.toHaveBeenCalled();

		await store.toggleGroupExpanded(1);
		expect(executeMock).toHaveBeenCalledWith('UPDATE series_groups SET is_expanded = $1 WHERE id = $2', [0, 1]);
		expect(store.groups[0].is_expanded).toBe(false);

		await store.toggleGroupExpanded(1);
		expect(executeMock).toHaveBeenCalledWith('UPDATE series_groups SET is_expanded = $1 WHERE id = $2', [1, 1]);
	});

	it('loads and calculates carry-over including January previous month', async () => {
		const store = new BudgetStore();
		store.year = 2026;
		store.month = 1;
		queryMock
			.mockResolvedValueOnce([{ planned_amount: 10000 }])
			.mockResolvedValueOnce([{ total: -3500 }])
			.mockResolvedValueOnce([{ series_id: 9, carry_amount: 6500 }]);

		await store.calculateCarryOver(9);

		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO budget_carry_over'), [9, 2026, 1, 6500]);
		expect(store.getCarryOver(9)).toBe(6500);
		expect(store.getCarryOver(99)).toBe(0);
	});

	it('calculates carry-over for non-January months with missing budget/actual rows', async () => {
		const store = new BudgetStore();
		store.year = 2026;
		store.month = 3;
		queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		await store.calculateCarryOver(9);

		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO budget_carry_over'), [9, 2026, 3, 0]);
	});

	it('loads previous month comparison and copies only missing budgets', async () => {
		const store = new BudgetStore();
		store.year = 2026;
		store.month = 3;
		store.monthlyBudgets = [{ id: 1, series_id: 1, year: 2026, month: 3, planned_amount: 1000 }];
		queryMock
			.mockResolvedValueOnce([{ series_id: 1, total: -500 }, { series_id: 2, total: -750 }])
			.mockResolvedValueOnce([{ series_id: 1, planned_amount: 1000 }, { series_id: 2, planned_amount: 2000 }])
			.mockResolvedValue([]);

		await store.loadPrevMonthComparison();
		const copied = await store.copyFromPreviousMonth();

		expect(store.getPrevMonthActual(2)).toBe(-750);
		expect(store.getPrevMonthActual(999)).toBe(0);
		expect(copied).toBe(1);
		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO monthly_budget'), [2, 2026, 3, 2000]);
	});

	it('handles January previous month comparison and skips reload when nothing is copied', async () => {
		const store = new BudgetStore();
		store.year = 2026;
		store.month = 1;
		store.monthlyBudgets = [{ id: 1, series_id: 1, year: 2026, month: 1, planned_amount: 1000 }];
		queryMock
			.mockResolvedValueOnce([{ series_id: 1, total: -500 }])
			.mockResolvedValueOnce([{ series_id: 1, planned_amount: 1000 }]);

		await store.loadPrevMonthComparison();
		const copied = await store.copyFromPreviousMonth();

		expect(queryMock).toHaveBeenNthCalledWith(1, expect.stringContaining('date >= $1'), ['2025-12-01', '2026-01-01']);
		expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining('monthly_budget'), [2025, 12]);
		expect(copied).toBe(0);
		expect(executeMock).not.toHaveBeenCalled();
	});
});

describe('CategorizationStore', () => {
	beforeEach(() => {
		queryMock.mockReset();
		executeMock.mockReset();
	});

	it('loads rules and toggles loading', async () => {
		const store = new CategorizationStore();
		queryMock.mockResolvedValueOnce([{ id: 1, label_pattern: 'EDF', series_id: 1 }]);

		await store.load();

		expect(store.rules).toHaveLength(1);
		expect(store.loading).toBe(false);
	});

	it('learns by inserting, incrementing or resetting rules', async () => {
		const store = new CategorizationStore();

		queryMock.mockResolvedValueOnce([]);
		await store.learn(tx(), 10, null);
		expect(executeMock).toHaveBeenCalledWith(
			'INSERT INTO categorization_rules (label_pattern, series_id, sub_series_id) VALUES ($1, $2, $3)',
			['CARREFOUR', 10, null]
		);

		queryMock.mockResolvedValueOnce([{ id: 5, series_id: 10 }]);
		await store.learn(tx({ original_label: 'CARREFOUR 9999' }), 10, 2);
		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('match_count = match_count + 1'), [2, 5]);

		queryMock.mockResolvedValueOnce([{ id: 5, series_id: 11 }]);
		await store.learn(tx(), 10, null);
		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('SET series_id = $1'), [10, null, 5]);
	});

	it('ignores empty anonymized labels and finds/applies similar transactions', async () => {
		const store = new CategorizationStore();

		await store.learn(tx({ label: '123456', original_label: null }), 1);
		expect(executeMock).not.toHaveBeenCalled();

		queryMock.mockResolvedValueOnce([tx({ id: 2 })]);
		await expect(store.findSimilarUncategorized(tx())).resolves.toHaveLength(1);

		executeMock.mockResolvedValueOnce({ rowsAffected: 3 });
		await expect(store.applyToSimilar(tx(), 4, 5)).resolves.toBe(3);

		executeMock.mockResolvedValueOnce(undefined as never);
		await expect(store.applyToSimilar(tx(), 4, 5)).resolves.toBe(0);

		await expect(store.findSimilarUncategorized(tx({ label: '123456' }))).resolves.toEqual([]);
		await expect(store.applyToSimilar(tx({ label: '123456' }), 4)).resolves.toBe(0);
	});

	it('updates, removes and backfills rules', async () => {
		const store = new CategorizationStore();
		queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([
			{ id: 1, label: 'EDF 123456', original_label: null },
			{ id: 2, label: 'Fallback', original_label: 'CARREFOUR 123456' }
		]);

		await store.updateRule(1, 2);
		await store.remove(1);
		await store.backfillLabels();

		expect(executeMock).toHaveBeenCalledWith(
			'UPDATE categorization_rules SET series_id = $1, last_used_at = CURRENT_TIMESTAMP WHERE id = $2',
			[2, 1]
		);
		expect(executeMock).toHaveBeenCalledWith('DELETE FROM categorization_rules WHERE id = $1', [1]);
		expect(executeMock).toHaveBeenCalledWith('UPDATE transactions SET label_for_categorization = $1 WHERE id = $2', ['EDF', 1]);
		expect(executeMock).toHaveBeenCalledWith('UPDATE transactions SET label_for_categorization = $1 WHERE id = $2', ['CARREFOUR', 2]);
	});
});

describe('ConfidentialStore', () => {
	beforeEach(() => {
		queryMock.mockReset();
		executeMock.mockReset();
	});

	it('loads, toggles and formats masked or visible amounts', async () => {
		const store = new ConfidentialStore();
		queryMock.mockResolvedValueOnce([{ value: '1' }]);

		await store.load();
		expect(store.enabled).toBe(true);
		expect(store.format(12345)).toBe(store.mask);

		await store.toggle();
		expect(store.enabled).toBe(false);
		expect(executeMock).toHaveBeenCalledWith(
			'INSERT OR REPLACE INTO app_settings (key, value) VALUES ($1, $2)',
			['confidential_mode', '0']
		);
		expect(store.format(12345)).toContain('123');
	});

	it('falls back to disabled mode when load or save fails', async () => {
		const store = new ConfidentialStore();
		queryMock.mockRejectedValueOnce(new Error('no table'));
		executeMock.mockRejectedValueOnce(new Error('readonly'));

		await store.load();
		expect(store.enabled).toBe(false);

		await store.toggle();
		expect(store.enabled).toBe(true);
	});
});

describe('NotesStore', () => {
	beforeEach(() => {
		queryMock.mockReset();
		executeMock.mockReset();
	});

	it('loads, clears on error, saves and changes month', async () => {
		const store = new NotesStore();
		queryMock.mockResolvedValueOnce([{ content: 'Budget mars' }]).mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce([]);

		await store.load();
		expect(store.content).toBe('Budget mars');

		await store.load();
		expect(store.content).toBe('');

		store.content = 'Avril';
		await store.save();
		expect(store.saving).toBe(false);
		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO notes'), [store.year, store.month, 'Avril']);

		await store.setMonth(2027, 4);
		expect(store.year).toBe(2027);
		expect(store.month).toBe(4);
	});
});

describe('ProjectStore', () => {
	beforeEach(() => {
		queryMock.mockReset();
		executeMock.mockReset();
	});

	it('loads projects with progress and records errors', async () => {
		const store = new ProjectStore();
		queryMock
			.mockResolvedValueOnce([{ id: 1, name: 'Vacances', target_amount: 100000, is_active: 1 }])
			.mockResolvedValueOnce([
				{ id: 1, project_id: 1, label: 'Train', planned_amount: 20000 },
				{ id: 2, project_id: 2, label: 'Autre', planned_amount: 999 }
			])
			.mockRejectedValueOnce(new Error('db'));

		await store.load();
		expect(store.projects[0].total_saved).toBe(20000);
		expect(store.projects[0].items).toHaveLength(1);

		await store.load();
		expect(store.error).toBe('db');
		expect(store.loading).toBe(false);

		queryMock.mockRejectedValueOnce('db');
		await store.load();
		expect(store.error).toBe('Erreur inconnue');
	});

	it('creates, updates, removes projects and items', async () => {
		const store = new ProjectStore();
		queryMock.mockResolvedValue([]);

		await store.create({ name: 'Cuisine', target_amount: 1000, target_date: '2027-01-01' });
		await store.update(1, {
			name: 'Cuisine équipée',
			target_amount: null,
			account_id: 2,
			// @ts-expect-error whitelist check
			unsafe: true
		});
		await store.remove(1);
		await store.addItem(1, { label: 'Four', planned_amount: 350, month: 4 });
		await store.removeItem(2);

		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO projects'), ['Cuisine', 100000, '2027-01-01', null]);
		expect(executeMock).toHaveBeenCalledWith(
			'UPDATE projects SET name = $1, target_amount = $2, account_id = $3 WHERE id = $4',
			['Cuisine équipée', null, 2, 1]
		);
		expect(executeMock).toHaveBeenCalledWith('UPDATE projects SET is_active = 0 WHERE id = $1', [1]);
		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO project_items'), [1, 'Four', 35000, 4, null]);
		expect(executeMock).toHaveBeenCalledWith('DELETE FROM project_items WHERE id = $1', [2]);

		await store.create({ name: 'Sans option' });
		await store.update(1, { target_amount: 10 });
		await store.addItem(1, { label: 'Sans date', planned_amount: 5 });
		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO projects'), ['Sans option', null, null, null]);
		expect(executeMock).toHaveBeenCalledWith('UPDATE projects SET target_amount = $1 WHERE id = $2', [1000, 1]);
		expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO project_items'), [1, 'Sans date', 500, null, null]);
	});

	it('skips empty project updates', async () => {
		const store = new ProjectStore();

		await store.update(1, {});

		expect(executeMock).not.toHaveBeenCalled();
	});
});
