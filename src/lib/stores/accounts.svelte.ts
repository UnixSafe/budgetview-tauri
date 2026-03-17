import { query, execute } from './db';
import type { Account } from '$lib/types';

class AccountStore {
	accounts = $state<Account[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);

	async load() {
		this.loading = true;
		this.error = null;
		try {
			this.accounts = await query<Account>(
				'SELECT * FROM accounts WHERE is_active = 1 ORDER BY name'
			);
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Erreur inconnue';
		} finally {
			this.loading = false;
		}
	}

	async create(data: { name: string; account_number?: string; bank_name?: string; account_type: string; initial_balance: number }) {
		await execute(
			'INSERT INTO accounts (name, account_number, bank_name, account_type, initial_balance) VALUES ($1, $2, $3, $4, $5)',
			[data.name, data.account_number ?? null, data.bank_name ?? null, data.account_type, data.initial_balance]
		);
		await this.load();
	}

	async update(id: number, data: Partial<{ name: string; account_number: string | null; bank_name: string | null; account_type: string; initial_balance: number }>) {
		const fields: string[] = [];
		const values: unknown[] = [];
		let i = 1;

		for (const [key, val] of Object.entries(data)) {
			if (val !== undefined) {
				fields.push(`${key} = $${i++}`);
				values.push(val);
			}
		}

		if (fields.length > 0) {
			values.push(id);
			await execute(`UPDATE accounts SET ${fields.join(', ')} WHERE id = $${i}`, values);
			await this.load();
		}
	}

	async remove(id: number) {
		await execute('UPDATE accounts SET is_active = 0 WHERE id = $1', [id]);
		await this.load();
	}

	getBalance(account: Account): number {
		return account.initial_balance;
	}

	get totalBalance(): number {
		return this.accounts.reduce((sum, a) => sum + a.initial_balance, 0);
	}
}

export const accountStore = new AccountStore();
