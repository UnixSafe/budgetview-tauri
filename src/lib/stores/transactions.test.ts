import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '$lib/types';

const mocks = vi.hoisted(() => ({
	query: vi.fn(),
	execute: vi.fn(),
	learn: vi.fn(),
	findSimilarUncategorized: vi.fn(),
	applyToSimilar: vi.fn(),
	push: vi.fn()
}));

vi.mock('./db', () => ({
	query: mocks.query,
	execute: mocks.execute
}));

vi.mock('./categorization.svelte', () => ({
	categorizationStore: {
		learn: mocks.learn,
		findSimilarUncategorized: mocks.findSimilarUncategorized,
		applyToSimilar: mocks.applyToSimilar
	}
}));

vi.mock('./undo.svelte', () => ({
	undoStore: {
		push: mocks.push
	}
}));

import { TransactionStore } from './transactions.svelte';

function transaction(overrides: Partial<Transaction> = {}): Transaction {
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

describe('TransactionStore', () => {
	beforeEach(() => {
		Object.values(mocks).forEach((mock) => mock.mockReset());
	});

	it('loads transactions with every filter and computes pagination', async () => {
		const store = new TransactionStore();
		store.filterAccountId = 1;
		store.filterSeriesId = 2;
		store.search = 'EDF';
		store.filterDateFrom = '2026-03-01';
		store.filterDateTo = '2026-03-31';
		mocks.query
			.mockResolvedValueOnce([{ count: 201 }])
			.mockResolvedValueOnce([transaction({ id: 1 }), transaction({ id: 2 })]);

		await store.load();

		expect(store.totalCount).toBe(201);
		expect(store.hasMore).toBe(true);
		expect(store.transactions).toHaveLength(2);
		expect(mocks.query).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining('t.account_id = $1'),
			[1, 2, '%EDF%', '2026-03-01', '2026-03-31']
		);
		expect(store.loading).toBe(false);
	});

	it('records load errors and handles missing count rows', async () => {
		const store = new TransactionStore();
		mocks.query.mockRejectedValueOnce(new Error('db'));

		await store.load();

		expect(store.error).toBe('db');
		expect(store.loading).toBe(false);

		mocks.query.mockRejectedValueOnce('raw db');
		await store.load();
		expect(store.error).toBe('Erreur inconnue');

		mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
		await store.load();
		expect(store.totalCount).toBe(0);
		expect(store.hasMore).toBe(false);
	});

	it('loads additional pages only when allowed', async () => {
		const store = new TransactionStore();

		await store.loadMore();
		expect(mocks.query).not.toHaveBeenCalled();

		store.transactions = [transaction({ id: 1 })];
		store.totalCount = 3;
		store.hasMore = true;
		mocks.query.mockResolvedValueOnce([transaction({ id: 2 }), transaction({ id: 3 })]);

		await store.loadMore();

		expect(store.transactions.map((tx) => tx.id)).toEqual([1, 2, 3]);
		expect(store.hasMore).toBe(false);
		expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('OFFSET 1'), []);
	});

	it('records loadMore errors and clears loadingMore', async () => {
		const store = new TransactionStore();
		store.hasMore = true;
		mocks.query.mockRejectedValueOnce(new Error('more failed'));

		await store.loadMore();

		expect(store.error).toBe('more failed');
		expect(store.loadingMore).toBe(false);

		mocks.query.mockRejectedValueOnce('raw more failed');
		store.hasMore = true;
		await store.loadMore();
		expect(store.error).toBe('Erreur inconnue');
	});

	it('creates transactions with cent amounts and anonymized labels', async () => {
		const store = new TransactionStore();
		mocks.query.mockResolvedValue([]);

		await store.create({ account_id: 1, date: '2026-03-17', label: 'EDF 123456', amount: -12.34, note: 'ok' });

		expect(mocks.execute).toHaveBeenCalledWith(
			expect.stringContaining('INSERT INTO transactions'),
			[1, '2026-03-17', 'EDF 123456', -1234, 'ok', null, 'EDF']
		);

		await store.create({ account_id: 1, date: '2026-03-18', label: '123456', amount: 1, series_id: null });
		expect(mocks.execute).toHaveBeenCalledWith(
			expect.stringContaining('INSERT INTO transactions'),
			[1, '2026-03-18', '123456', 100, null, null, null]
		);
	});

	it('updates whitelisted fields and refreshes anonymized label when label changes', async () => {
		const store = new TransactionStore();
		mocks.query.mockResolvedValue([]);

		await store.update(1, {
			label: 'CARREFOUR 123456',
			amount: -10,
			note: null,
			// @ts-expect-error runtime whitelist
			unsafe: true
		});

		expect(mocks.execute).toHaveBeenCalledWith(
			'UPDATE transactions SET label = $1, amount = $2, note = $3, label_for_categorization = $4 WHERE id = $5',
			['CARREFOUR 123456', -1000, null, 'CARREFOUR', 1]
		);

		await store.update(1, { label: '123456' });
		expect(mocks.execute).toHaveBeenCalledWith(
			'UPDATE transactions SET label = $1, label_for_categorization = $2 WHERE id = $3',
			['123456', null, 1]
		);

		await store.update(1, {});
		expect(mocks.execute).toHaveBeenCalledTimes(2);
	});

	it('categorizes, learns non-excluded labels, counts similar transactions and pushes undo', async () => {
		const store = new TransactionStore();
		const source = transaction({ series_id: 3, sub_series_id: 4 });
		store.transactions = [source];
		mocks.findSimilarUncategorized.mockResolvedValueOnce([transaction({ id: 2 })]);
		mocks.query.mockResolvedValue([]);

		const count = await store.categorize(1, 5, 6);

		expect(count).toBe(1);
		expect(mocks.execute).toHaveBeenCalledWith(
			'UPDATE transactions SET series_id = $1, sub_series_id = $2, is_auto_categorized = 0 WHERE id = $3',
			[5, 6, 1]
		);
		expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({ label: 'Catégorisation de "CARREFOUR 123456"' }));
		expect(mocks.learn).toHaveBeenCalledWith(source, 5, 6);

		const undo = mocks.push.mock.calls[0][0].undo;
		await undo();
		expect(mocks.execute).toHaveBeenCalledWith(
			'UPDATE transactions SET series_id = $1, sub_series_id = $2 WHERE id = $3',
			[3, 4, 1]
		);
	});

	it('categorizes unknown or excluded transactions without learning', async () => {
		const store = new TransactionStore();
		mocks.query.mockResolvedValue([]);

		await expect(store.categorize(99, null)).resolves.toBe(0);

		store.transactions = [transaction({ label: 'RETRAIT DAB 50', original_label: null })];
		await expect(store.categorize(1, 5)).resolves.toBe(0);

		expect(mocks.learn).not.toHaveBeenCalled();
	});

	it('applies to similar transactions and handles missing source transactions', async () => {
		const store = new TransactionStore();
		store.transactions = [transaction()];
		mocks.applyToSimilar.mockResolvedValueOnce(3);
		mocks.query.mockResolvedValue([]);

		await expect(store.applyToSimilar(1, 5, null)).resolves.toBe(3);
		await expect(store.applyToSimilar(99, 5, null)).resolves.toBe(0);
	});

	it('batch categorizes ids, learns eligible labels and skips empty batches', async () => {
		const store = new TransactionStore();
		const first = transaction({ id: 1, label: 'EDF 123456' });
		store.transactions = [
			first,
			transaction({ id: 2, label: 'CHEQUE 123456' }),
			transaction({ id: 3, label: 'CARREFOUR 123456' })
		];
		mocks.query.mockResolvedValue([]);

		await expect(store.batchCategorize([], 1)).resolves.toBe(0);
		await expect(store.batchCategorize([1, 2, 99], 7, 8)).resolves.toBe(3);
		await expect(store.batchCategorize([3], null)).resolves.toBe(1);

		expect(mocks.execute).toHaveBeenCalledWith(
			'UPDATE transactions SET series_id = $1, sub_series_id = $2, is_auto_categorized = 0 WHERE id = $3',
			[7, 8, 1]
		);
		expect(mocks.learn).toHaveBeenCalledTimes(1);
		expect(mocks.learn).toHaveBeenCalledWith(first, 7, 8);
	});

	it('removes transactions and registers undo when the transaction is known', async () => {
		const store = new TransactionStore();
		store.transactions = [transaction({ id: 4, series_id: 2, sub_series_id: 3 })];
		mocks.query.mockResolvedValue([]);

		await store.remove(4);

		expect(mocks.execute).toHaveBeenCalledWith('DELETE FROM transactions WHERE id = $1', [4]);
		expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({ label: 'Suppression de "CARREFOUR 123456"' }));

		const undo = mocks.push.mock.calls[0][0].undo;
		await undo();
		expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO transactions'), [
			1,
			'2026-03-17',
			'CARREFOUR 123456',
			null,
			-4200,
			null,
			2,
			3,
			'CARREFOUR'
		]);
	});

	it('removes unknown transactions without registering undo', async () => {
		const store = new TransactionStore();
		mocks.query.mockResolvedValue([]);

		await store.remove(99);

		expect(mocks.execute).toHaveBeenCalledWith('DELETE FROM transactions WHERE id = $1', [99]);
		expect(mocks.push).not.toHaveBeenCalled();
	});
});
