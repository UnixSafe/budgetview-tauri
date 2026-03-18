import { invoke } from '@tauri-apps/api/core';
import { query, execute } from './db';
import type { RecurringTransaction, RecurringPattern, RecurrenceFrequency } from '$lib/types';
import { toCents } from '$lib/utils/format';

class RecurringStore {
	items = $state<RecurringTransaction[]>([]);
	patterns = $state<RecurringPattern[]>([]);
	loading = $state(false);
	detecting = $state(false);
	error = $state<string | null>(null);

	async load() {
		this.loading = true;
		this.error = null;
		try {
			this.items = await query<RecurringTransaction>(
				`SELECT r.*, a.name as account_name, bs.name as series_name
				 FROM recurring_transactions r
				 LEFT JOIN accounts a ON r.account_id = a.id
				 LEFT JOIN budget_series bs ON r.series_id = bs.id
				 WHERE r.is_active = 1
				 ORDER BY r.label`
			);
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

	async create(data: {
		account_id: number;
		label: string;
		amount: number; // euros
		series_id: number | null;
		frequency: RecurrenceFrequency;
		day_of_month: number | null;
		label_pattern?: string;
		is_auto_detected?: boolean;
	}) {
		await execute(
			`INSERT INTO recurring_transactions (account_id, label, amount, series_id, frequency, day_of_month, label_pattern, is_auto_detected)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				data.account_id,
				data.label,
				toCents(data.amount),
				data.series_id,
				data.frequency,
				data.day_of_month,
				data.label_pattern ?? null,
				data.is_auto_detected ? 1 : 0
			]
		);
		await this.load();
	}

	async confirmPattern(pattern: RecurringPattern) {
		await execute(
			`INSERT INTO recurring_transactions (account_id, label, amount, series_id, frequency, day_of_month, label_pattern, is_auto_detected)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
			[
				pattern.account_id,
				pattern.label,
				pattern.avg_amount,
				pattern.series_id,
				pattern.frequency,
				pattern.day_of_month,
				pattern.label
			]
		);
		// Remove from patterns list
		this.patterns = this.patterns.filter(
			(p) => !(p.label === pattern.label && p.account_id === pattern.account_id)
		);
		await this.load();
	}

	async remove(id: number) {
		await execute('UPDATE recurring_transactions SET is_active = 0 WHERE id = $1', [id]);
		await this.load();
	}

	async update(
		id: number,
		data: Partial<{
			label: string;
			amount: number;
			series_id: number | null;
			frequency: RecurrenceFrequency;
			day_of_month: number | null;
		}>
	) {
		const fields: string[] = [];
		const values: unknown[] = [];
		let i = 1;

		const allowed = new Set(['label', 'amount', 'series_id', 'frequency', 'day_of_month']);
		for (const [key, val] of Object.entries(data)) {
			if (val !== undefined && allowed.has(key)) {
				fields.push(`${key} = $${i++}`);
				values.push(key === 'amount' ? toCents(val as number) : val);
			}
		}

		if (fields.length > 0) {
			values.push(id);
			await execute(
				`UPDATE recurring_transactions SET ${fields.join(', ')} WHERE id = $${i}`,
				values
			);
			await this.load();
		}
	}
}

export const recurringStore = new RecurringStore();
