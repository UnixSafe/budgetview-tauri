import { invoke } from '@tauri-apps/api/core';
import type { RecurringTransaction, RecurringPattern, MissingRecurrence } from '$lib/types';

const FREQUENCY_LABELS: Record<string, string> = {
	weekly: 'Hebdomadaire',
	biweekly: 'Bimensuel',
	monthly: 'Mensuel',
	quarterly: 'Trimestriel',
	biannual: 'Semestriel',
	yearly: 'Annuel'
};

export class RecurringStore {
	items = $state<RecurringTransaction[]>([]);
	patterns = $state<RecurringPattern[]>([]);
	missing = $state<MissingRecurrence[]>([]);
	loading = $state(false);
	detecting = $state(false);
	error = $state<string | null>(null);

	async load() {
		this.loading = true;
		this.error = null;
		try {
			this.items = await invoke<RecurringTransaction[]>('get_recurring_transactions');
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		} finally {
			this.loading = false;
		}
	}

	async detect() {
		this.detecting = true;
		this.error = null;
		try {
			this.patterns = await invoke<RecurringPattern[]>('detect_recurring_patterns', {
				minOccurrences: 3
			});
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		} finally {
			this.detecting = false;
		}
	}

	async confirmPattern(pattern: RecurringPattern) {
		await invoke('create_recurring', {
			label: pattern.label,
			labelPattern: pattern.label,
			accountId: pattern.account_id,
			amount: pattern.avg_amount,
			seriesId: pattern.series_id,
			frequency: pattern.frequency,
			dayOfMonth: pattern.day_of_month
		});
		this.patterns = this.patterns.filter(
			(p) => !(p.label === pattern.label && p.account_id === pattern.account_id)
		);
		await this.load();
	}

	async update(
		id: number,
		data: Partial<{
			label: string;
			amount: number;
			seriesId: number;
			frequency: string;
			dayOfMonth: number;
			isActive: boolean;
			toleranceDays: number;
		}>
	) {
		await invoke('update_recurring', { id, ...data });
		await this.load();
	}

	async remove(id: number) {
		await invoke('delete_recurring', { id });
		await this.load();
	}

	async checkMissing() {
		try {
			this.missing = await invoke<MissingRecurrence[]>('check_missing_recurrences');
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		}
	}

	get activeCount(): number {
		return this.items.filter((r) => r.is_active).length;
	}

	get missingCount(): number {
		return this.missing.length;
	}

	static frequencyLabel(freq: string | null): string {
		return (freq && FREQUENCY_LABELS[freq]) ?? freq ?? '—';
	}
}

export const recurringStore = new RecurringStore();
