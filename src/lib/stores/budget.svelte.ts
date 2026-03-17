import { query, execute } from './db';
import type { BudgetSeries, MonthlyBudget, BudgetLineItem, BudgetArea } from '$lib/types';
import { toCents } from '$lib/utils/format';

class BudgetStore {
	series = $state<BudgetSeries[]>([]);
	monthlyBudgets = $state<MonthlyBudget[]>([]);
	budgetLines = $state<BudgetLineItem[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	year = $state(new Date().getFullYear());
	month = $state(new Date().getMonth() + 1);

	async loadSeries() {
		this.series = await query<BudgetSeries>(
			'SELECT * FROM budget_series WHERE is_active = 1 ORDER BY budget_area, name'
		);
	}

	async loadBudgetView() {
		this.loading = true;
		this.error = null;
		try {
			await this.loadSeries();

			// Get monthly budgets for current period
			this.monthlyBudgets = await query<MonthlyBudget>(
				'SELECT * FROM monthly_budget WHERE year = $1 AND month = $2',
				[this.year, this.month]
			);

			// Build date range for the month
			const startDate = `${this.year}-${String(this.month).padStart(2, '0')}-01`;
			const endMonth = this.month === 12 ? 1 : this.month + 1;
			const endYear = this.month === 12 ? this.year + 1 : this.year;
			const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

			// Get actual amounts per series for this month
			const actuals = await query<{ series_id: number; total: number }>(
				`SELECT series_id, SUM(amount) as total
				 FROM transactions
				 WHERE date >= $1 AND date < $2 AND series_id IS NOT NULL
				 GROUP BY series_id`,
				[startDate, endDate]
			);

			const actualMap = new Map(actuals.map((a) => [a.series_id, a.total]));
			const budgetMap = new Map(this.monthlyBudgets.map((b) => [b.series_id, b.planned_amount]));

			this.budgetLines = this.series.map((s) => {
				const planned = budgetMap.get(s.id) ?? s.target_amount ?? 0;
				const actual = actualMap.get(s.id) ?? 0;
				return {
					series_id: s.id,
					series_name: s.name,
					budget_area: s.budget_area,
					planned_amount: planned,
					actual_amount: actual
				};
			});
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Erreur inconnue';
		} finally {
			this.loading = false;
		}
	}

	async createSeries(data: { name: string; budget_area: BudgetArea; target_amount?: number; description?: string }) {
		await execute(
			'INSERT INTO budget_series (name, budget_area, target_amount, description) VALUES ($1, $2, $3, $4)',
			[data.name, data.budget_area, data.target_amount != null ? toCents(data.target_amount) : null, data.description ?? null]
		);
		await this.loadBudgetView();
	}

	private static readonly ALLOWED_COLUMNS = new Set(['name', 'budget_area', 'target_amount', 'description']);

	async updateSeries(id: number, data: Partial<{ name: string; budget_area: BudgetArea; target_amount: number | null; description: string | null }>) {
		const fields: string[] = [];
		const values: unknown[] = [];
		let i = 1;

		for (const [key, val] of Object.entries(data)) {
			if (val !== undefined && BudgetStore.ALLOWED_COLUMNS.has(key)) {
				fields.push(`${key} = $${i++}`);
				values.push(key === 'target_amount' && val != null ? toCents(val as number) : val);
			}
		}

		if (fields.length > 0) {
			values.push(id);
			await execute(`UPDATE budget_series SET ${fields.join(', ')} WHERE id = $${i}`, values);
			await this.loadBudgetView();
		}
	}

	async removeSeries(id: number) {
		await execute('UPDATE budget_series SET is_active = 0 WHERE id = $1', [id]);
		await this.loadBudgetView();
	}

	async setMonthlyBudget(seriesId: number, amount: number) {
		await execute(
			`INSERT INTO monthly_budget (series_id, year, month, planned_amount)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT(series_id, year, month) DO UPDATE SET planned_amount = $4`,
			[seriesId, this.year, this.month, toCents(amount)]
		);
		await this.loadBudgetView();
	}

	get groupedByArea(): Record<BudgetArea, BudgetLineItem[]> {
		const groups: Record<BudgetArea, BudgetLineItem[]> = {
			income: [],
			recurring: [],
			variable: [],
			extras: [],
			savings: [],
			transfers: []
		};
		for (const line of this.budgetLines) {
			groups[line.budget_area].push(line);
		}
		return groups;
	}

	get totalPlanned(): number {
		return this.budgetLines.reduce((s, l) => s + l.planned_amount, 0);
	}

	get totalActual(): number {
		return this.budgetLines.reduce((s, l) => s + l.actual_amount, 0);
	}
}

export const budgetStore = new BudgetStore();
