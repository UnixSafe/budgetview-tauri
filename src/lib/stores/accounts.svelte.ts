import { query, execute } from './db';
import type { Account } from '$lib/types';
import { toCents } from '$lib/utils/format';

interface AccountWithBalance extends Account {
	computed_balance: number;
}

class AccountStore {
	accounts = $state<AccountWithBalance[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);

	async load() {
		this.loading = true;
		this.error = null;
		try {
			this.accounts = await query<AccountWithBalance>(
				`SELECT a.*,
					a.initial_balance + COALESCE(
						(SELECT SUM(t.amount) FROM transactions t WHERE t.account_id = a.id),
						0
					) as computed_balance
				 FROM accounts a
				 WHERE a.is_active = 1
				 ORDER BY a.name`
			);
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Erreur inconnue';
		} finally {
			this.loading = false;
		}
	}

	async create(data: { name: string; account_number?: string; bank_name?: string; account_type: string; initial_balance: number }): Promise<number> {
		const result = await execute(
			'INSERT INTO accounts (name, account_number, bank_name, account_type, initial_balance) VALUES ($1, $2, $3, $4, $5)',
			[data.name, data.account_number ?? null, data.bank_name ?? null, data.account_type, toCents(data.initial_balance)]
		);
		await this.load();
		return result.lastInsertId ?? 0;
	}

	private static readonly ALLOWED_COLUMNS = new Set(['name', 'account_number', 'bank_name', 'account_type', 'initial_balance']);

	async update(id: number, data: Partial<{ name: string; account_number: string | null; bank_name: string | null; account_type: string; initial_balance: number }>) {
		const fields: string[] = [];
		const values: unknown[] = [];
		let i = 1;

		for (const [key, val] of Object.entries(data)) {
			if (val !== undefined && AccountStore.ALLOWED_COLUMNS.has(key)) {
				fields.push(`${key} = $${i++}`);
				values.push(key === 'initial_balance' ? toCents(val as number) : val);
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

	getBalance(account: AccountWithBalance): number {
		return account.computed_balance;
	}

	get totalBalance(): number {
		return this.accounts.reduce((sum, a) => sum + a.computed_balance, 0);
	}
}

export const accountStore = new AccountStore();
