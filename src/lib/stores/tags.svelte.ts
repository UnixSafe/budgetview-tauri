import { execute, query } from './db';
import type { TransactionTag } from '$lib/types';

export class TagStore {
	tags = $state<TransactionTag[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);

	async load() {
		this.loading = true;
		this.error = null;
		try {
			this.tags = await query<TransactionTag>('SELECT * FROM tags ORDER BY name');
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Erreur inconnue';
		} finally {
			this.loading = false;
		}
	}

	async create(name: string): Promise<number> {
		const normalized = name.trim();
		if (!normalized) return 0;

		const result = await execute('INSERT OR IGNORE INTO tags (name) VALUES ($1)', [normalized]);
		await this.load();

		const lastInsertId = result && typeof result === 'object' && 'lastInsertId' in result ? Number(result.lastInsertId) : 0;
		if (lastInsertId > 0) return lastInsertId;

		const rows = await query<{ id: number }>('SELECT id FROM tags WHERE name = $1', [normalized]);
		return rows[0]?.id ?? 0;
	}

	async remove(id: number) {
		await execute('DELETE FROM tags WHERE id = $1', [id]);
		await this.load();
	}

	async addToTransaction(transactionId: number, tagId: number) {
		await execute(
			'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES ($1, $2)',
			[transactionId, tagId]
		);
	}

	async removeFromTransaction(transactionId: number, tagId: number) {
		await execute(
			'DELETE FROM transaction_tags WHERE transaction_id = $1 AND tag_id = $2',
			[transactionId, tagId]
		);
	}
}

export const tagStore = new TagStore();
