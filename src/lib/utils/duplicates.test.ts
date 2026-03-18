import { describe, it, expect, vi } from 'vitest';

// Mock the db query since it depends on Tauri
vi.mock('$lib/stores/db', () => ({
	query: vi.fn().mockResolvedValue([])
}));

import { findPotentialDuplicates } from './duplicates';
import { query } from '$lib/stores/db';

describe('findPotentialDuplicates', () => {
	it('calls query with correct params', async () => {
		await findPotentialDuplicates('2026-03-18', -5000, 'CARREFOUR', 1);

		expect(query).toHaveBeenCalledWith(
			expect.stringContaining('account_id = $1'),
			expect.arrayContaining([1, -5000, '2026-03-18'])
		);
	});

	it('excludes specific transaction ID when provided', async () => {
		await findPotentialDuplicates('2026-03-18', -5000, 'CARREFOUR', 1, 42);

		expect(query).toHaveBeenCalledWith(
			expect.stringContaining('t.id != $4'),
			expect.arrayContaining([1, -5000, '2026-03-18', 42])
		);
	});

	it('returns empty array when no duplicates', async () => {
		const result = await findPotentialDuplicates('2026-03-18', -5000, 'CARREFOUR', 1);
		expect(result).toEqual([]);
	});
});
