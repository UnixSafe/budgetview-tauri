import { query, execute } from './db';
import type { BudgetSeries, SubSeries, MonthlyBudget, BudgetLineItem, BudgetArea, SeriesGroup, BudgetCarryOver } from '$lib/types';
import { toCents } from '$lib/utils/format';

class BudgetStore {
	series = $state<BudgetSeries[]>([]);
	subSeries = $state<SubSeries[]>([]);
	monthlyBudgets = $state<MonthlyBudget[]>([]);
	budgetLines = $state<BudgetLineItem[]>([]);
	groups = $state<SeriesGroup[]>([]);
	carryOvers = $state<BudgetCarryOver[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	year = $state(new Date().getFullYear());
	month = $state(new Date().getMonth() + 1);

	async loadSeries() {
		this.series = await query<BudgetSeries>(
			'SELECT * FROM budget_series WHERE is_active = 1 ORDER BY budget_area, name'
		);
		this.subSeries = await query<SubSeries>(
			'SELECT * FROM sub_series ORDER BY name'
		);
		this.groups = await query<SeriesGroup>(
			'SELECT * FROM series_groups ORDER BY sort_order, name'
		);
	}

	/** Get sub-series for a specific series */
	getSubSeries(seriesId: number): SubSeries[] {
		return this.subSeries.filter((s) => s.series_id === seriesId);
	}

	async createSubSeries(seriesId: number, name: string) {
		await execute('INSERT INTO sub_series (series_id, name) VALUES ($1, $2)', [seriesId, name]);
		await this.loadSeries();
	}

	async removeSubSeries(id: number) {
		await execute('DELETE FROM sub_series WHERE id = $1', [id]);
		await this.loadSeries();
	}

	async updateSubSeries(id: number, name: string) {
		await execute('UPDATE sub_series SET name = $1 WHERE id = $2', [name, id]);
		await this.loadSeries();
	}

	async loadBudgetView() {
		this.loading = true;
		this.error = null;
		try {
			await this.loadSeries();
			await this.loadCarryOvers();

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

	private static readonly ALLOWED_COLUMNS = new Set(['name', 'budget_area', 'target_amount', 'description', 'group_id']);

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

	// === Series Groups ===
	async createGroup(name: string) {
		await execute('INSERT INTO series_groups (name) VALUES ($1)', [name]);
		await this.loadSeries();
	}

	async updateGroup(id: number, name: string) {
		await execute('UPDATE series_groups SET name = $1 WHERE id = $2', [name, id]);
		await this.loadSeries();
	}

	async removeGroup(id: number) {
		await execute('DELETE FROM series_groups WHERE id = $1', [id]);
		await this.loadSeries();
	}

	async toggleGroupExpanded(id: number) {
		const group = this.groups.find(g => g.id === id);
		if (!group) return;
		await execute('UPDATE series_groups SET is_expanded = $1 WHERE id = $2', [group.is_expanded ? 0 : 1, id]);
		group.is_expanded = !group.is_expanded;
	}

	async assignSeriesToGroup(seriesId: number, groupId: number | null) {
		await execute('UPDATE budget_series SET group_id = $1 WHERE id = $2', [groupId, seriesId]);
		await this.loadSeries();
	}

	// === Budget Carry-over ===
	async loadCarryOvers() {
		this.carryOvers = await query<BudgetCarryOver>(
			'SELECT * FROM budget_carry_over WHERE year = $1 AND month = $2',
			[this.year, this.month]
		);
	}

	async calculateCarryOver(seriesId: number) {
		// Previous month
		let prevMonth = this.month - 1;
		let prevYear = this.year;
		if (prevMonth === 0) { prevMonth = 12; prevYear--; }

		const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
		const endDate = `${this.year}-${String(this.month).padStart(2, '0')}-01`;

		// Get previous month planned
		const prevBudget = await query<{ planned_amount: number }>(
			'SELECT planned_amount FROM monthly_budget WHERE series_id = $1 AND year = $2 AND month = $3',
			[seriesId, prevYear, prevMonth]
		);
		const planned = prevBudget[0]?.planned_amount ?? 0;

		// Get previous month actual
		const prevActual = await query<{ total: number }>(
			'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE series_id = $1 AND date >= $2 AND date < $3',
			[seriesId, startDate, endDate]
		);
		const actual = prevActual[0]?.total ?? 0;

		// Carry = planned - |actual| (remaining budget carries forward)
		const carry = planned - Math.abs(actual);

		await execute(
			`INSERT INTO budget_carry_over (series_id, year, month, carry_amount)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT(series_id, year, month) DO UPDATE SET carry_amount = $4`,
			[seriesId, this.year, this.month, carry]
		);
		await this.loadCarryOvers();
	}

	getCarryOver(seriesId: number): number {
		return this.carryOvers.find(c => c.series_id === seriesId)?.carry_amount ?? 0;
	}

	groupedByArea = $derived.by<Record<BudgetArea, BudgetLineItem[]>>(() => {
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
	});

	totalPlanned = $derived(this.budgetLines.reduce((s, l) => s + l.planned_amount, 0));

	totalActual = $derived(this.budgetLines.reduce((s, l) => s + l.actual_amount, 0));

	// Previous month comparison data
	prevMonthActuals = $state<Map<number, number>>(new Map());

	async loadPrevMonthComparison() {
		let prevMonth = this.month - 1;
		let prevYear = this.year;
		if (prevMonth === 0) { prevMonth = 12; prevYear--; }

		const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
		const endDate = `${this.year}-${String(this.month).padStart(2, '0')}-01`;

		const actuals = await query<{ series_id: number; total: number }>(
			`SELECT series_id, SUM(amount) as total
			 FROM transactions
			 WHERE date >= $1 AND date < $2 AND series_id IS NOT NULL
			 GROUP BY series_id`,
			[startDate, endDate]
		);

		this.prevMonthActuals = new Map(actuals.map(a => [a.series_id, a.total]));
	}

	getPrevMonthActual(seriesId: number): number {
		return this.prevMonthActuals.get(seriesId) ?? 0;
	}
}

export const budgetStore = new BudgetStore();
