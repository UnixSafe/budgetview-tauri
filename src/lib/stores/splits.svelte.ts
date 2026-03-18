import { invoke } from '@tauri-apps/api/core';
import type { Split, SplitInput } from '$lib/types';

class SplitStore {
	splits = $state<Split[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);

	/** Set of transaction IDs known to have splits */
	splitTransactionIds = $state<Set<number>>(new Set());

	async load(transactionId: number) {
		this.loading = true;
		this.error = null;
		try {
			this.splits = await invoke<Split[]>('get_splits', { transactionId });
			if (this.splits.length > 0) {
				this.splitTransactionIds = new Set([...this.splitTransactionIds, transactionId]);
			} else {
				const next = new Set(this.splitTransactionIds);
				next.delete(transactionId);
				this.splitTransactionIds = next;
			}
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		} finally {
			this.loading = false;
		}
	}

	async create(transactionId: number, splits: SplitInput[]): Promise<Split[]> {
		this.error = null;
		try {
			const result = await invoke<Split[]>('create_splits', { transactionId, splits });
			this.splits = result;
			this.splitTransactionIds = new Set([...this.splitTransactionIds, transactionId]);
			return result;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			throw e;
		}
	}

	async remove(transactionId: number) {
		this.error = null;
		try {
			await invoke<void>('delete_splits', { transactionId });
			this.splits = [];
			const next = new Set(this.splitTransactionIds);
			next.delete(transactionId);
			this.splitTransactionIds = next;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			throw e;
		}
	}

	async updateSplit(splitId: number, amountCents: number, seriesId: number, subSeriesId: number | null, note: string | null) {
		this.error = null;
		try {
			await invoke<void>('update_split', { splitId, amountCents, seriesId, subSeriesId, note });
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			throw e;
		}
	}

	/** Load all transaction IDs that have splits (batch, for list display) */
	async loadBatchStatus() {
		try {
			const ids = await invoke<number[]>('get_transactions_with_splits');
			this.splitTransactionIds = new Set(ids);
		} catch (e) {
			// Non-blocking: just log
			console.error('Failed to load split status:', e);
		}
	}

	hasSplits(transactionId: number): boolean {
		return this.splitTransactionIds.has(transactionId);
	}

	clear() {
		this.splits = [];
		this.error = null;
	}
}

export const splitStore = new SplitStore();
