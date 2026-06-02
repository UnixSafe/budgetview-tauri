import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

vi.mock('./db', () => ({
	query: vi.fn(),
	execute: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';
import { query, execute } from './db';
import { AiStore, aiStore } from './ai.svelte';
import { ImportStore } from './import.svelte';
import { RecurringStore } from './recurring.svelte';
import { SplitStore } from './splits.svelte';

const invokeMock = vi.mocked(invoke);
const queryMock = vi.mocked(query);
const executeMock = vi.mocked(execute);

describe('AiStore', () => {
	beforeEach(() => {
		invokeMock.mockReset();
		queryMock.mockReset();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('loads stored provider, model and API key state', async () => {
		const store = new AiStore();
		invokeMock
			.mockResolvedValueOnce('openrouter')
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce('secret');

		await store.load();

		expect(store.provider).toBe('openrouter');
		expect(store.model).toBe('meta-llama/llama-4-scout');
		expect(store.hasKey).toBe(true);

		invokeMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
		await store.load();
		expect(store.provider).toBe('none');
		expect(store.model).toBe('');
	});

	it('uses an empty model fallback for unknown providers', async () => {
		const store = new AiStore();
		invokeMock.mockResolvedValueOnce('custom').mockResolvedValueOnce(null).mockResolvedValueOnce(null);

		await store.load();

		expect(store.provider).toBe('custom' as 'none');
		expect(store.model).toBe('');
	});

	it('falls back to disabled AI when settings cannot be loaded', async () => {
		const store = new AiStore();
		invokeMock.mockRejectedValueOnce(new Error('missing'));

		await store.load();

		expect(store.provider).toBe('none');
		expect(store.hasKey).toBe(false);
	});

	it('sets provider, model and API key state', async () => {
		const store = new AiStore();
		invokeMock.mockResolvedValue('xai-key');

		await store.setProvider('xai');
		await store.setModel('grok-custom');
		await store.setApiKey('xai', 'abc');
		await store.removeApiKey('xai');
		await store.setProvider('none');

		expect(invokeMock).toHaveBeenCalledWith('save_ai_setting', { key: 'ai_provider', value: 'xai' });
		expect(invokeMock).toHaveBeenCalledWith('save_ai_setting', { key: 'ai_model', value: 'grok-3-mini' });
		expect(invokeMock).toHaveBeenCalledWith('save_ai_setting', { key: 'ai_model', value: 'grok-custom' });
		expect(invokeMock).toHaveBeenCalledWith('save_ai_setting', { key: 'xai_api_key', value: 'abc' });
		expect(invokeMock).toHaveBeenCalledWith('delete_ai_setting', { key: 'xai_api_key' });
		expect(store.hasKey).toBe(false);
	});

	it('skips AI categorization when disabled, unkeyed or empty', async () => {
		const store = new AiStore();

		await expect(store.categorizeTransactions([{ id: 1, label: 'EDF', amount: -1000 }])).resolves.toEqual(new Map());

		store.provider = 'xai';
		store.hasKey = false;
		await expect(store.categorizeTransactions([{ id: 1, label: 'EDF', amount: -1000 }])).resolves.toEqual(new Map());

		store.hasKey = true;
		await expect(store.categorizeTransactions([])).resolves.toEqual(new Map());
	});

	it('categorizes transactions from valid JSON response and filters unknown categories', async () => {
		const store = new AiStore();
		store.provider = 'openrouter';
		store.model = 'model';
		store.hasKey = true;
		invokeMock.mockResolvedValueOnce('api-key');
		queryMock.mockResolvedValueOnce([{ name: 'Courses' }]);
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				choices: [{ message: { content: 'prefix [{"id":1,"category":"Courses"},{"id":2,"category":"Autre"}] suffix' } }]
			})
			} as Response);

			const result = await store.categorizeTransactions([
				{ id: 1, label: 'CARREFOUR', amount: 1234 },
				{ id: 2, label: 'INCONNU', amount: -999 }
			]);

		expect(result).toEqual(new Map([[1, 'Courses']]));
		expect(store.lastResult).toContain('"Courses"');
		expect(store.loading).toBe(false);
		expect(fetch).toHaveBeenCalledWith(
			'https://openrouter.ai/api/v1/chat/completions',
			expect.objectContaining({
				headers: expect.objectContaining({ 'HTTP-Referer': 'https://budgetview.fr', Authorization: 'Bearer api-key' })
			})
		);
	});

	it('reports AI errors for missing keys, unsupported providers, HTTP errors and invalid JSON', async () => {
		const store = new AiStore();
		store.provider = 'xai';
		store.hasKey = true;

		invokeMock.mockResolvedValueOnce(null);
		await expect(store.categorizeTransactions([{ id: 1, label: 'EDF', amount: -100 }])).resolves.toEqual(new Map());
		expect(store.error).toBe('Clé API non configurée');

		store.provider = 'custom' as 'xai';
		invokeMock.mockResolvedValueOnce('key');
		queryMock.mockResolvedValueOnce([]);
		await expect(store.categorizeTransactions([{ id: 1, label: 'EDF', amount: -100 }])).resolves.toEqual(new Map());
		expect(store.error).toBe('Provider non supporté');

		store.provider = 'xai';
		invokeMock.mockResolvedValueOnce('key');
		queryMock.mockResolvedValueOnce([]);
		vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'server exploded' } as Response);
		await expect(store.categorizeTransactions([{ id: 1, label: 'EDF', amount: -100 }])).resolves.toEqual(new Map());
		expect(store.error).toContain('API xai: 500');

		invokeMock.mockResolvedValueOnce('key');
		queryMock.mockResolvedValueOnce([{ name: 'EDF' }]);
		vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'no json' } }] }) } as Response);
		await expect(store.categorizeTransactions([{ id: 1, label: 'EDF', amount: -100 }])).resolves.toEqual(new Map());

		invokeMock.mockResolvedValueOnce('key');
		queryMock.mockResolvedValueOnce([]);
		vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [] }) } as Response);
		await expect(store.categorizeTransactions([{ id: 1, label: 'EDF', amount: -100 }])).resolves.toEqual(new Map());

		invokeMock.mockRejectedValueOnce('raw ai error');
		await expect(store.categorizeTransactions([{ id: 1, label: 'EDF', amount: -100 }])).resolves.toEqual(new Map());
		expect(store.error).toBe('raw ai error');
	});
});

describe('ImportStore', () => {
	beforeEach(() => {
		invokeMock.mockReset();
		queryMock.mockReset();
		executeMock.mockReset();
		aiStore.provider = 'none';
		aiStore.hasKey = false;
	});

	it('loads preview and CSV metadata through Tauri commands', async () => {
		const store = new ImportStore();
		invokeMock
			.mockResolvedValueOnce({ transactions: [{ label: 'A' }], duplicates: [1] })
			.mockResolvedValueOnce({ headers: ['date'], detected_config: { date_column: 'date' } });

		await store.loadPreview('/tmp/file.csv');
		await store.detectCsvColumns('/tmp/file.csv');

		expect(store.preview?.duplicates).toEqual([1]);
		expect(store.csvConfig).toEqual({ date_column: 'date' });
		expect(invokeMock).toHaveBeenCalledWith('import_preview', { filePath: '/tmp/file.csv', csvConfig: null });
		expect(invokeMock).toHaveBeenCalledWith('detect_csv_columns', { filePath: '/tmp/file.csv' });
	});

	it('records preview and CSV detection errors', async () => {
		const store = new ImportStore();
		invokeMock
			.mockRejectedValueOnce(new Error('bad file'))
			.mockRejectedValueOnce('bad csv')
			.mockRejectedValueOnce('raw preview')
			.mockRejectedValueOnce(new Error('bad csv error'));

		await store.loadPreview('/tmp/bad.csv');
		await store.detectCsvColumns('/tmp/bad.csv');
		await store.loadPreview('/tmp/raw.csv');
		await store.detectCsvColumns('/tmp/error.csv');

		expect(store.preview).toBeNull();
		expect(store.error).toBe('bad csv error');
		expect(store.loading).toBe(false);
	});

	it('does nothing when confirming without a selected file', async () => {
		const store = new ImportStore();

		await store.confirmImport(1);

		expect(invokeMock).not.toHaveBeenCalled();
	});

	it('confirms imports with deduplicated skips and dictionary categorization', async () => {
		const store = new ImportStore();
		store.filePath = '/tmp/import.csv';
		store.preview = {
			format: 'csv',
			account_number: null,
			bank_id: null,
			transactions: [],
			duplicates: [1, 2],
			total_count: 0,
			new_count: 0
		};
		invokeMock.mockResolvedValueOnce({ imported_count: 2, duplicate_count: 0, auto_categorized_count: 1, batch_id: 77 });
		queryMock
			.mockResolvedValueOnce([{ id: 10, label: 'carrefour market' }, { id: 11, label: 'edf' }])
			.mockResolvedValueOnce([
				{ pattern: 'EDF', series_id: 2, priority: 5 },
				{ pattern: 'CARREFOUR', series_id: 1, priority: 9 }
			]);

		await store.confirmImport(3, [2, 4]);

		expect(invokeMock).toHaveBeenCalledWith('import_confirm', {
			filePath: '/tmp/import.csv',
			accountId: 3,
			csvConfig: null,
			skipIndices: [1, 2, 4]
		});
		expect(executeMock).toHaveBeenCalledWith('UPDATE transactions SET series_id = $1, is_auto_categorized = 1 WHERE id = $2', [1, 10]);
		expect(executeMock).toHaveBeenCalledWith('UPDATE transactions SET series_id = $1, is_auto_categorized = 1 WHERE id = $2', [2, 11]);
		expect(store.result?.auto_categorized_count).toBe(3);
	});

	it('handles imports with no result or no dictionary keywords', async () => {
		const store = new ImportStore();
		store.filePath = '/tmp/import.csv';
		invokeMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ imported_count: 1, duplicate_count: 0, auto_categorized_count: 0, batch_id: 88 });
		queryMock.mockResolvedValueOnce([{ id: 10, label: 'anything' }]).mockResolvedValueOnce([]);

		await store.confirmImport(1);
		expect(store.result).toBeNull();

		await store.confirmImport(1);
		expect(store.result?.auto_categorized_count).toBe(0);
	});

	it('keeps the highest priority dictionary match and skips unmatched labels', async () => {
		const store = new ImportStore();
		store.filePath = '/tmp/import.csv';
		invokeMock.mockResolvedValueOnce({ imported_count: 1, duplicate_count: 0, auto_categorized_count: 0, batch_id: 90 });
		queryMock
			.mockResolvedValueOnce([{ id: 10, label: 'station leclerc' }, { id: 11, label: 'unknown label' }])
			.mockResolvedValueOnce([
				{ pattern: 'LECLERC', series_id: 1, priority: 5 },
				{ pattern: 'STATION', series_id: 2, priority: 10 },
				{ pattern: 'station leclerc', series_id: 3, priority: 1 }
			]);

		await store.confirmImport(1);

		expect(executeMock).toHaveBeenCalledTimes(1);
		expect(executeMock).toHaveBeenCalledWith('UPDATE transactions SET series_id = $1, is_auto_categorized = 1 WHERE id = $2', [2, 10]);
	});

	it('returns zero for dictionary/AI failures and rollback failures', async () => {
		const store = new ImportStore();
		store.filePath = '/tmp/import.csv';
		invokeMock
			.mockResolvedValueOnce({ imported_count: 1, duplicate_count: 0, auto_categorized_count: 0, batch_id: 1 })
			.mockRejectedValueOnce(new Error('rollback'));
		queryMock.mockRejectedValueOnce(new Error('dict down'));

		await store.confirmImport(1);
		const rollback = await store.rollback(1);

		expect(store.result?.auto_categorized_count).toBe(0);
		expect(rollback).toBe(0);
		expect(store.error).toBe('rollback');

		invokeMock.mockRejectedValueOnce('raw rollback');
		await expect(store.rollback(2)).resolves.toBe(0);
		expect(store.error).toBe('raw rollback');
	});

	it('records confirmation command errors', async () => {
		const store = new ImportStore();
		store.filePath = '/tmp/import.csv';
		invokeMock.mockRejectedValueOnce(new Error('confirm failed'));

		await store.confirmImport(1);

		expect(store.error).toBe('confirm failed');
		expect(store.loading).toBe(false);

		invokeMock.mockRejectedValueOnce('raw confirm failed');
		await store.confirmImport(1);
		expect(store.error).toBe('raw confirm failed');
	});

	it('applies AI categorization after dictionary fallback', async () => {
		const store = new ImportStore();
		store.filePath = '/tmp/import.csv';
		aiStore.provider = 'xai';
		aiStore.hasKey = true;
		vi.spyOn(aiStore, 'load').mockResolvedValueOnce();
		vi.spyOn(aiStore, 'categorizeTransactions').mockResolvedValueOnce(new Map([[20, 'Courses'], [21, 'Unknown']]));
		invokeMock.mockResolvedValueOnce({ imported_count: 1, duplicate_count: 0, auto_categorized_count: 0, batch_id: 2 });
		queryMock
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 20, label: 'CARREFOUR', amount: -1000 }])
			.mockResolvedValueOnce([{ id: 1, name: 'Courses' }]);

		await store.confirmImport(1);

		expect(executeMock).toHaveBeenCalledWith('UPDATE transactions SET series_id = $1, is_auto_categorized = 1 WHERE id = $2', [1, 20]);
		expect(store.result?.auto_categorized_count).toBe(1);
		vi.restoreAllMocks();
	});

	it('returns zero when AI fallback throws internally', async () => {
		const store = new ImportStore();
		store.filePath = '/tmp/import.csv';
		aiStore.provider = 'xai';
		aiStore.hasKey = true;
		invokeMock.mockResolvedValueOnce({ imported_count: 1, duplicate_count: 0, auto_categorized_count: 0, batch_id: 2 });
		queryMock.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('ai query down'));

		await store.confirmImport(1);

		expect(store.result?.auto_categorized_count).toBe(0);
	});

	it('returns zero when AI fallback has no uncategorized rows or no suggestions', async () => {
		const store = new ImportStore();
		store.filePath = '/tmp/import.csv';
		aiStore.provider = 'xai';
		aiStore.hasKey = true;
		invokeMock
			.mockResolvedValueOnce({ imported_count: 1, duplicate_count: 0, auto_categorized_count: 0, batch_id: 3 })
			.mockResolvedValueOnce({ imported_count: 1, duplicate_count: 0, auto_categorized_count: 0, batch_id: 4 });
		queryMock
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 30, label: 'EDF', amount: -1000 }]);
		vi.spyOn(aiStore, 'load').mockResolvedValueOnce();
		vi.spyOn(aiStore, 'categorizeTransactions').mockResolvedValueOnce(new Map());

		await store.confirmImport(1);
		await store.confirmImport(1);

		expect(store.result?.auto_categorized_count).toBe(0);
		vi.restoreAllMocks();
	});

	it('resets all import state', () => {
		const store = new ImportStore();
		store.preview = {
			format: 'csv',
			account_number: null,
			bank_id: null,
			transactions: [],
			duplicates: [],
			total_count: 0,
			new_count: 0
		};
		store.loading = true;
		store.error = 'err';
		store.filePath = '/tmp/a';
		store.result = { imported_count: 1, duplicates_skipped: 0, auto_categorized_count: 0, batch_id: 1, account_id: 1 };
		store.csvConfig = {
			delimiter: ',',
			date_column: 0,
			label_column: 1,
			amount_column: 2,
			debit_column: null,
			credit_column: null,
			date_format: '%Y-%m-%d',
			skip_lines: 1,
			decimal_separator: '.'
		};
		store.csvColumnInfo = { headers: [], sample_rows: [], detected_config: store.csvConfig };

		store.reset();

		expect(store.preview).toBeNull();
		expect(store.loading).toBe(false);
		expect(store.error).toBeNull();
		expect(store.filePath).toBeNull();
		expect(store.result).toBeNull();
		expect(store.csvConfig).toBeNull();
		expect(store.csvColumnInfo).toBeNull();
	});
});

describe('RecurringStore', () => {
	beforeEach(() => {
		invokeMock.mockReset();
	});

	it('loads, detects, confirms, updates, removes and checks recurring transactions', async () => {
		const store = new RecurringStore();
		const pattern = {
			label: 'EDF',
			account_id: 1,
			account_name: 'Compte',
			avg_amount: -5000,
			series_id: 2,
			series_name: 'Charges',
			frequency: 'monthly' as const,
			day_of_month: 5,
			transaction_count: 3,
			last_date: '2026-03-05'
		};
		invokeMock
			.mockResolvedValueOnce([{ id: 1, is_active: 1 }, { id: 2, is_active: 0 }])
			.mockResolvedValueOnce([pattern])
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce([{ id: 1, is_active: 1 }])
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce([{ id: 1, is_active: 1 }])
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ recurring_id: 1 }]);

		await store.load();
		expect(store.activeCount).toBe(1);
		await store.detect();
		await store.confirmPattern(pattern);
		await store.update(1, { label: 'EDF bleu', isActive: true });
		await store.remove(1);
		await store.checkMissing();

		expect(store.activeCount).toBe(0);
		expect(store.missingCount).toBe(1);
		expect(RecurringStore.frequencyLabel('monthly')).toBe('Mensuel');
		expect(RecurringStore.frequencyLabel('unknown')).toBe('unknown');
		expect(RecurringStore.frequencyLabel(null)).toBe('—');
	});

	it('records recurring command errors', async () => {
		const store = new RecurringStore();
		invokeMock.mockRejectedValue(new Error('tauri'));

		await store.load();
		await store.detect();
		await store.checkMissing();

		expect(store.error).toBe('tauri');
		expect(store.loading).toBe(false);
		expect(store.detecting).toBe(false);

		invokeMock.mockRejectedValue('raw tauri');
		await store.load();
		await store.detect();
		await store.checkMissing();
		expect(store.error).toBe('raw tauri');
	});
});

describe('SplitStore', () => {
	beforeEach(() => {
		invokeMock.mockReset();
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	it('loads, creates, updates, removes and clears split state', async () => {
		const store = new SplitStore();
		invokeMock
			.mockResolvedValueOnce([{ id: 1, transaction_id: 5, amount: 100 }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 2, transaction_id: 5, amount: 200 }])
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce([1, 3]);

		await store.load(5);
		expect(store.hasSplits(5)).toBe(true);

		await store.load(5);
		expect(store.hasSplits(5)).toBe(false);

		await expect(store.create(5, [{ amount_cents: 200, series_id: 1, sub_series_id: null, note: null }])).resolves.toHaveLength(1);
		await store.updateSplit(2, 200, 1, null, 'note');
		await store.remove(5);
		await store.loadBatchStatus();
		expect(store.hasSplits(3)).toBe(true);

		store.clear();
		expect(store.splits).toEqual([]);
		expect(store.error).toBeNull();
	});

	it('stores and rethrows split errors while batch status remains non-blocking', async () => {
		const store = new SplitStore();
		invokeMock
			.mockRejectedValueOnce(new Error('load failed'))
			.mockRejectedValueOnce(new Error('create failed'))
			.mockRejectedValueOnce(new Error('remove failed'))
			.mockRejectedValueOnce(new Error('update failed'))
			.mockRejectedValueOnce(new Error('batch failed'));

		await store.load(1);
		expect(store.error).toBe('load failed');
		await expect(store.create(1, [])).rejects.toThrow('create failed');
		await expect(store.remove(1)).rejects.toThrow('remove failed');
		await expect(store.updateSplit(1, 100, 2, null, null)).rejects.toThrow('update failed');
			await store.loadBatchStatus();

			expect(console.error).toHaveBeenCalledWith('Failed to load split status:', expect.any(Error));

		invokeMock
			.mockRejectedValueOnce('raw load')
			.mockRejectedValueOnce('raw create')
			.mockRejectedValueOnce('raw remove')
			.mockRejectedValueOnce('raw update');
		await store.load(1);
		expect(store.error).toBe('raw load');
		await expect(store.create(1, [])).rejects.toBe('raw create');
		expect(store.error).toBe('raw create');
		await expect(store.remove(1)).rejects.toBe('raw remove');
		expect(store.error).toBe('raw remove');
		await expect(store.updateSplit(1, 100, 2, null, null)).rejects.toBe('raw update');
		expect(store.error).toBe('raw update');
			vi.restoreAllMocks();
		});
});
