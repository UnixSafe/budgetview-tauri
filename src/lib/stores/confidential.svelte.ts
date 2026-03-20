import { query, execute } from './db';

const MASK = '***,** \u20AC';

class ConfidentialStore {
	enabled = $state(false);

	async load() {
		try {
			const rows = await query<{ value: string }>('SELECT value FROM app_settings WHERE key = $1', ['confidential_mode']);
			this.enabled = rows[0]?.value === '1';
		} catch {
			this.enabled = false;
		}
	}

	async toggle() {
		this.enabled = !this.enabled;
		try {
			await execute('INSERT OR REPLACE INTO app_settings (key, value) VALUES ($1, $2)', ['confidential_mode', this.enabled ? '1' : '0']);
		} catch { /* ignore */ }
	}

	/** Format a centimes amount, masking it if confidential mode is on */
	format(cents: number): string {
		if (this.enabled) return MASK;
		return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
	}

	/** Returns the mask string for use in chart callbacks etc. */
	get mask(): string {
		return MASK;
	}
}

export const confidentialStore = new ConfidentialStore();
