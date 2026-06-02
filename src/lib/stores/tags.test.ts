import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({
	query: vi.fn(),
	execute: vi.fn()
}));

import { execute, query } from './db';
import { TagStore } from './tags.svelte';

const queryMock = vi.mocked(query);
const executeMock = vi.mocked(execute);

describe('TagStore', () => {
	beforeEach(() => {
		queryMock.mockReset();
		executeMock.mockReset();
	});

	it('loads tags and records load errors', async () => {
		const store = new TagStore();
		queryMock.mockResolvedValueOnce([{ id: 1, name: 'Pro' }]);

		await store.load();

		expect(store.tags).toEqual([{ id: 1, name: 'Pro' }]);
		expect(store.loading).toBe(false);

		queryMock.mockRejectedValueOnce(new Error('db'));
		await store.load();
		expect(store.error).toBe('db');
	});

	it('creates tags and falls back to querying the existing id', async () => {
		const store = new TagStore();
		executeMock.mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 12 });
		queryMock.mockResolvedValueOnce([]);

		await expect(store.create(' Vacances ')).resolves.toBe(12);
		expect(executeMock).toHaveBeenCalledWith('INSERT OR IGNORE INTO tags (name) VALUES ($1)', ['Vacances']);

		executeMock.mockResolvedValueOnce({ rowsAffected: 0 });
		queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 7 }]);
		await expect(store.create('Vacances')).resolves.toBe(7);

		await expect(store.create('   ')).resolves.toBe(0);
	});

	it('removes tags and updates transaction assignments', async () => {
		const store = new TagStore();
		queryMock.mockResolvedValue([]);

		await store.remove(3);
		await store.addToTransaction(10, 3);
		await store.removeFromTransaction(10, 3);

		expect(executeMock).toHaveBeenCalledWith('DELETE FROM tags WHERE id = $1', [3]);
		expect(executeMock).toHaveBeenCalledWith(
			'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES ($1, $2)',
			[10, 3]
		);
		expect(executeMock).toHaveBeenCalledWith(
			'DELETE FROM transaction_tags WHERE transaction_id = $1 AND tag_id = $2',
			[10, 3]
		);
	});
});
