import { invoke } from '@tauri-apps/api/core';
import type { Split, SplitInput } from '$lib/types';

class SplitStore {
	splits = $state<Split[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);

	async load(transactionId: number) {
		this.loading = true;
		this.error = null;
		try {
			this.splits = await invoke<Split[]>('get_splits', { transactionId });
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
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			throw e;
		}
	}

	async updateSplit(splitId: number, amountCents: number, seriesId: number, note: string | null) {
		this.error = null;
		try {
			await invoke<void>('update_split', { splitId, amountCents, seriesId, note });
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			throw e;
		}
	}

	hasSplits(transactionId: number): boolean {
		return this.splits.length > 0 && this.splits[0]?.transaction_id === transactionId;
	}

	clear() {
		this.splits = [];
		this.error = null;
	}
}

export const splitStore = new SplitStore();
