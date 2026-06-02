import { describe, expect, it } from 'vitest';

import { buildTransactionWhere } from './transactions.svelte';

describe('buildTransactionWhere', () => {
	it('builds account, category, search and date filters with ordered params', () => {
		const result = buildTransactionWhere({
			accountId: 2,
			seriesId: 7,
			search: 'carrefour',
			dateFrom: '2026-01-01',
			dateTo: '2026-01-31',
			amountMin: '',
			amountMax: '',
			categorization: '',
			reconciled: ''
		});

		expect(result.clause).toContain('t.account_id = $1');
		expect(result.clause).toContain('t.series_id = $2');
		expect(result.clause).toContain('t.label LIKE $3');
		expect(result.clause).toContain('t.date >= $4');
		expect(result.clause).toContain('t.date <= $5');
		expect(result.params).toEqual([2, 7, '%carrefour%', '2026-01-01', '2026-01-31']);
	});

	it('converts amount bounds to cents', () => {
		const result = buildTransactionWhere({
			accountId: '',
			seriesId: '',
			search: '',
			dateFrom: '',
			dateTo: '',
			amountMin: '-25,50',
			amountMax: '100.25',
			categorization: '',
			reconciled: ''
		});

		expect(result.clause).toContain('t.amount >= $1');
		expect(result.clause).toContain('t.amount <= $2');
		expect(result.params).toEqual([-2550, 10025]);
	});

	it('ignores invalid amount bounds', () => {
		const result = buildTransactionWhere({
			accountId: '',
			seriesId: '',
			search: '',
			dateFrom: '',
			dateTo: '',
			amountMin: 'abc',
			amountMax: ' ',
			categorization: '',
			reconciled: ''
		});

		expect(result.clause).toBe(' WHERE 1=1');
		expect(result.params).toEqual([]);
	});

	it('filters categorized and uncategorized transactions without extra params', () => {
		const categorized = buildTransactionWhere({
			accountId: '',
			seriesId: '',
			search: '',
			dateFrom: '',
			dateTo: '',
			amountMin: '',
			amountMax: '',
			categorization: 'categorized',
			reconciled: ''
		});
		const uncategorized = buildTransactionWhere({
			accountId: '',
			seriesId: '',
			search: '',
			dateFrom: '',
			dateTo: '',
			amountMin: '',
			amountMax: '',
			categorization: 'uncategorized',
			reconciled: ''
		});

		expect(categorized.clause).toContain('t.series_id IS NOT NULL');
		expect(uncategorized.clause).toContain('t.series_id IS NULL');
		expect(categorized.params).toEqual([]);
		expect(uncategorized.params).toEqual([]);
	});

	it('filters reconciled and unreconciled transactions without extra params', () => {
		const reconciled = buildTransactionWhere({
			accountId: '',
			seriesId: '',
			search: '',
			dateFrom: '',
			dateTo: '',
			amountMin: '',
			amountMax: '',
			categorization: '',
			reconciled: 'yes'
		});
		const unreconciled = buildTransactionWhere({
			accountId: '',
			seriesId: '',
			search: '',
			dateFrom: '',
			dateTo: '',
			amountMin: '',
			amountMax: '',
			categorization: '',
			reconciled: 'no'
		});

		expect(reconciled.clause).toContain('t.is_reconciled = 1');
		expect(unreconciled.clause).toContain('COALESCE(t.is_reconciled, 0) = 0');
		expect(reconciled.params).toEqual([]);
		expect(unreconciled.params).toEqual([]);
	});
});
