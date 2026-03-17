<script lang="ts">
	import { onMount } from 'svelte';
	import { BarChart3, TrendingUp, PieChart, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-svelte';
	import { query } from '$lib/stores/db';
	import { formatCurrency, formatMonth, BUDGET_AREA_LABELS } from '$lib/utils/format';
	import { Chart, registerables } from 'chart.js';
	import type { BudgetArea } from '$lib/types';

	Chart.register(...registerables);

	// Chart defaults for dark theme
	Chart.defaults.color = '#94a3b8';
	Chart.defaults.borderColor = '#334155';
	Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

	let year = $state(new Date().getFullYear());
	let loading = $state(true);

	// Data
	let monthlyData = $state<{ month: number; income: number; expenses: number }[]>([]);
	let categoryData = $state<{ name: string; area: string; total: number }[]>([]);
	let topExpenses = $state<{ label: string; total: number; count: number }[]>([]);

	// Forecast data
	let forecastLabels = $state<string[]>([]);
	let forecastActual = $state<(number | null)[]>([]);
	let forecastProjected = $state<(number | null)[]>([]);

	// Chart refs
	let barCanvas: HTMLCanvasElement;
	let doughnutCanvas: HTMLCanvasElement;
	let lineCanvas: HTMLCanvasElement;
	let forecastCanvas: HTMLCanvasElement;
	let barChart: Chart | null = null;
	let doughnutChart: Chart | null = null;
	let lineChart: Chart | null = null;
	let forecastChart: Chart | null = null;

	async function loadData() {
		loading = true;
		try {
			// Monthly income/expenses for the year
			const monthlyRaw = await query<{ month: number; income: number; expenses: number }>(
				`SELECT
					CAST(strftime('%m', date) AS INTEGER) as month,
					COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
					COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses
				FROM transactions
				WHERE strftime('%Y', date) = $1
				GROUP BY strftime('%m', date)
				ORDER BY month`,
				[String(year)]
			);
			monthlyData = monthlyRaw;

			// Spending by category (only expenses)
			categoryData = await query<{ name: string; area: string; total: number }>(
				`SELECT bs.name, bs.budget_area as area,
					ABS(SUM(t.amount)) as total
				FROM transactions t
				JOIN budget_series bs ON t.series_id = bs.id
				WHERE t.amount < 0 AND strftime('%Y', t.date) = $1
				GROUP BY bs.id
				ORDER BY total DESC`,
				[String(year)]
			);

			// Top expense labels
			topExpenses = await query<{ label: string; total: number; count: number }>(
				`SELECT label,
					ABS(SUM(amount)) as total,
					COUNT(*) as count
				FROM transactions
				WHERE amount < 0 AND strftime('%Y', date) = $1
				GROUP BY UPPER(label)
				ORDER BY total DESC
				LIMIT 10`,
				[String(year)]
			);

			// Cash flow forecast: current balance + projected from budget
			await loadForecast();

			renderCharts();
		} finally {
			loading = false;
		}
	}

	async function loadForecast() {
		const now = new Date();
		const currentMonth = now.getMonth() + 1;
		const currentYear = now.getFullYear();

		// Get current total balance (initial + transactions)
		const balResult = await query<{ total: number }>(
			`SELECT COALESCE(SUM(a.initial_balance), 0) + COALESCE((SELECT SUM(t.amount) FROM transactions t JOIN accounts a2 ON t.account_id = a2.id WHERE a2.is_active = 1), 0) as total
			 FROM accounts a WHERE a.is_active = 1`
		);
		let currentBalance = balResult[0]?.total ?? 0;

		// Get monthly actuals for the past 3 months
		const labels: string[] = [];
		const actual: (number | null)[] = [];
		const projected: (number | null)[] = [];

		for (let offset = -3; offset <= 6; offset++) {
			let m = currentMonth + offset;
			let y = currentYear;
			while (m <= 0) { m += 12; y--; }
			while (m > 12) { m -= 12; y++; }

			const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(new Date(y, m - 1));
			labels.push(monthLabel);

			if (offset < 0) {
				// Past month: get actual net flow
				const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
				const endM = m === 12 ? 1 : m + 1;
				const endY = m === 12 ? y + 1 : y;
				const endDate = `${endY}-${String(endM).padStart(2, '0')}-01`;

				const netResult = await query<{ net: number }>(
					`SELECT COALESCE(SUM(amount), 0) as net FROM transactions WHERE date >= $1 AND date < $2`,
					[startDate, endDate]
				);
				actual.push(null); // We don't track running historical balance here
				projected.push(null);
			} else if (offset === 0) {
				// Current month: actual balance
				actual.push(currentBalance);
				projected.push(currentBalance);
			} else {
				// Future: project using budget data
				const budgetNet = await query<{ net: number }>(
					`SELECT COALESCE(SUM(
						CASE WHEN bs.budget_area = 'income' THEN mb.planned_amount
						ELSE -ABS(mb.planned_amount) END
					), 0) as net
					FROM monthly_budget mb
					JOIN budget_series bs ON mb.series_id = bs.id
					WHERE mb.year = $1 AND mb.month = $2`,
					[y, m]
				);
				currentBalance += budgetNet[0]?.net ?? 0;
				actual.push(null);
				projected.push(currentBalance);
			}
		}

		// Fill in past actual balances by working backwards from current
		let bal = actual[3]!; // index 3 = current month (offset 0)
		for (let i = 2; i >= 0; i--) {
			const offset = i - 3;
			let m = currentMonth + offset;
			let y = currentYear;
			while (m <= 0) { m += 12; y--; }
			while (m > 12) { m -= 12; y++; }

			const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
			const endM = m === 12 ? 1 : m + 1;
			const endY = m === 12 ? y + 1 : y;
			const endDate = `${endY}-${String(endM).padStart(2, '0')}-01`;

			const netResult = await query<{ net: number }>(
				`SELECT COALESCE(SUM(amount), 0) as net FROM transactions WHERE date >= $1 AND date < $2`,
				[startDate, endDate]
			);
			bal -= netResult[0]?.net ?? 0;
			actual[i] = bal;
		}

		forecastLabels = labels;
		forecastActual = actual;
		forecastProjected = projected;
	}

	const AREA_COLORS: Record<string, string> = {
		income: '#22c55e',
		recurring: '#3b82f6',
		variable: '#f59e0b',
		extras: '#8b5cf6',
		savings: '#06b6d4',
		transfers: '#64748b'
	};

	const MONTH_LABELS = [
		'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
		'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
	];

	function renderCharts() {
		// Destroy existing charts
		barChart?.destroy();
		doughnutChart?.destroy();
		lineChart?.destroy();
		forecastChart?.destroy();

		if (!barCanvas || !doughnutCanvas || !lineCanvas) return;

		// Prepare full 12-month arrays
		const incomeByMonth = new Array(12).fill(0);
		const expensesByMonth = new Array(12).fill(0);
		for (const d of monthlyData) {
			incomeByMonth[d.month - 1] = d.income;
			expensesByMonth[d.month - 1] = d.expenses;
		}

		// Bar chart: Income vs Expenses by month
		barChart = new Chart(barCanvas, {
			type: 'bar',
			data: {
				labels: MONTH_LABELS,
				datasets: [
					{
						label: 'Revenus',
						data: incomeByMonth,
						backgroundColor: '#22c55e88',
						borderColor: '#22c55e',
						borderWidth: 1,
						borderRadius: 4
					},
					{
						label: 'Dépenses',
						data: expensesByMonth,
						backgroundColor: '#ef444488',
						borderColor: '#ef4444',
						borderWidth: 1,
						borderRadius: 4
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { position: 'top' },
					tooltip: {
						callbacks: {
							label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback: (v) => formatCurrency(Number(v))
						}
					}
				}
			}
		});

		// Doughnut chart: Spending by category
		if (categoryData.length > 0) {
			const colors = categoryData.map((c) => AREA_COLORS[c.area] ?? '#64748b');
			doughnutChart = new Chart(doughnutCanvas, {
				type: 'doughnut',
				data: {
					labels: categoryData.map((c) => c.name),
					datasets: [{
						data: categoryData.map((c) => c.total),
						backgroundColor: colors.map((c) => c + '88'),
						borderColor: colors,
						borderWidth: 2
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: 'right',
							labels: { boxWidth: 12, padding: 8 }
						},
						tooltip: {
							callbacks: {
								label: (ctx) => {
									const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
									const pct = ((ctx.parsed / total) * 100).toFixed(1);
									return `${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
								}
							}
						}
					}
				}
			});
		}

		// Line chart: Cumulative balance evolution
		const cumulativeBalance = new Array(12).fill(0);
		let running = 0;
		for (let i = 0; i < 12; i++) {
			running += incomeByMonth[i] - expensesByMonth[i];
			cumulativeBalance[i] = running;
		}

		lineChart = new Chart(lineCanvas, {
			type: 'line',
			data: {
				labels: MONTH_LABELS,
				datasets: [{
					label: 'Solde cumulé',
					data: cumulativeBalance,
					borderColor: '#3b82f6',
					backgroundColor: '#3b82f633',
					fill: true,
					tension: 0.3,
					pointBackgroundColor: '#3b82f6',
					pointRadius: 4
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { position: 'top' },
					tooltip: {
						callbacks: {
							label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`
						}
					}
				},
				scales: {
					y: {
						ticks: {
							callback: (v) => formatCurrency(Number(v))
						}
					}
				}
			}
		});

		// Forecast chart: cash flow projection
		if (forecastCanvas && forecastLabels.length > 0) {
			forecastChart = new Chart(forecastCanvas, {
				type: 'line',
				data: {
					labels: forecastLabels,
					datasets: [
						{
							label: 'Réalisé',
							data: forecastActual,
							borderColor: '#3b82f6',
							backgroundColor: '#3b82f633',
							fill: false,
							tension: 0.3,
							pointBackgroundColor: '#3b82f6',
							pointRadius: 4,
							spanGaps: false
						},
						{
							label: 'Prévisionnel',
							data: forecastProjected,
							borderColor: '#f59e0b',
							backgroundColor: '#f59e0b33',
							borderDash: [5, 5],
							fill: false,
							tension: 0.3,
							pointBackgroundColor: '#f59e0b',
							pointRadius: 4,
							spanGaps: false
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						tooltip: {
							callbacks: {
								label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`
							}
						}
					},
					scales: {
						y: {
							ticks: {
								callback: (v) => formatCurrency(Number(v))
							}
						}
					}
				}
			});
		}
	}

	function prevYear() { year--; loadData(); }
	function nextYear() { year++; loadData(); }

	onMount(() => {
		loadData();
		return () => {
			barChart?.destroy();
			doughnutChart?.destroy();
			lineChart?.destroy();
			forecastChart?.destroy();
		};
	});

	// Computed: total income/expenses for the year
	let totalIncome = $derived(monthlyData.reduce((s, d) => s + d.income, 0));
	let totalExpenses = $derived(monthlyData.reduce((s, d) => s + d.expenses, 0));
	let balance = $derived(totalIncome - totalExpenses);

	// Grouped categories by budget area
	let categoryByArea = $derived.by(() => {
		const groups: Record<string, { name: string; total: number }[]> = {};
		for (const c of categoryData) {
			if (!groups[c.area]) groups[c.area] = [];
			groups[c.area].push({ name: c.name, total: c.total });
		}
		return groups;
	});
</script>

<svelte:head>
	<title>Analyse — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header with year navigation -->
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-text-primary">Analyse</h1>
		<div class="flex items-center gap-3">
			<button onclick={prevYear}
				class="rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
				<ChevronLeft size={20} />
			</button>
			<span class="text-lg font-semibold text-text-primary min-w-[4rem] text-center">{year}</span>
			<button onclick={nextYear}
				class="rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
				<ChevronRight size={20} />
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
		</div>
	{:else if monthlyData.length === 0 && categoryData.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-12">
			<BarChart3 size={48} class="mb-4 text-text-muted" />
			<p class="text-lg font-medium text-text-secondary">Pas encore de données pour {year}</p>
			<p class="text-sm text-text-muted">Les graphiques apparaîtront une fois des transactions importées</p>
		</div>
	{:else}
		<!-- Summary cards -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<p class="text-sm text-text-muted">Revenus {year}</p>
				<p class="text-2xl font-bold text-income">{formatCurrency(totalIncome)}</p>
			</div>
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<p class="text-sm text-text-muted">Dépenses {year}</p>
				<p class="text-2xl font-bold text-expense">{formatCurrency(totalExpenses)}</p>
			</div>
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<p class="text-sm text-text-muted">Balance</p>
				<p class="text-2xl font-bold" class:text-income={balance >= 0} class:text-expense={balance < 0}>
					{formatCurrency(balance)}
				</p>
			</div>
		</div>

		<!-- Bar chart: Monthly income vs expenses -->
		<div class="rounded-xl border border-border bg-bg-card p-4">
			<div class="mb-3 flex items-center gap-2">
				<BarChart3 size={18} class="text-accent" />
				<h2 class="text-lg font-semibold text-text-primary">Revenus vs Dépenses par mois</h2>
			</div>
			<div class="h-72">
				<canvas bind:this={barCanvas}></canvas>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Doughnut chart: Spending by category -->
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<div class="mb-3 flex items-center gap-2">
					<PieChart size={18} class="text-warning" />
					<h2 class="text-lg font-semibold text-text-primary">Dépenses par catégorie</h2>
				</div>
				{#if categoryData.length > 0}
					<div class="h-72">
						<canvas bind:this={doughnutCanvas}></canvas>
					</div>
				{:else}
					<p class="py-8 text-center text-sm text-text-muted">Aucune transaction catégorisée</p>
				{/if}
			</div>

			<!-- Line chart: Cumulative balance -->
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<div class="mb-3 flex items-center gap-2">
					<TrendingUp size={18} class="text-income" />
					<h2 class="text-lg font-semibold text-text-primary">Évolution du solde cumulé</h2>
				</div>
				<div class="h-72">
					<canvas bind:this={lineCanvas}></canvas>
				</div>
			</div>
		</div>

		<!-- Forecast chart: Cash flow projection -->
		<div class="rounded-xl border border-border bg-bg-card p-4">
			<div class="mb-3 flex items-center gap-2">
				<CalendarClock size={18} class="text-warning" />
				<h2 class="text-lg font-semibold text-text-primary">Trésorerie prévisionnelle</h2>
			</div>
			<p class="mb-2 text-xs text-text-muted">Projection basée sur le budget planifié pour les 6 prochains mois</p>
			<div class="h-72">
				<canvas bind:this={forecastCanvas}></canvas>
			</div>
		</div>

		<!-- Top expenses table -->
		<div class="rounded-xl border border-border bg-bg-card p-4">
			<h2 class="mb-3 text-lg font-semibold text-text-primary">Top 10 des dépenses</h2>
			{#if topExpenses.length > 0}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-border text-left text-text-muted">
								<th class="pb-2 font-medium">#</th>
								<th class="pb-2 font-medium">Libellé</th>
								<th class="pb-2 text-right font-medium">Montant total</th>
								<th class="pb-2 text-right font-medium">Occurrences</th>
							</tr>
						</thead>
						<tbody>
							{#each topExpenses as expense, i}
								<tr class="border-b border-border/50">
									<td class="py-2 text-text-muted">{i + 1}</td>
									<td class="py-2 text-text-primary">{expense.label}</td>
									<td class="py-2 text-right font-medium text-expense">{formatCurrency(expense.total)}</td>
									<td class="py-2 text-right text-text-secondary">{expense.count}×</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="py-4 text-center text-sm text-text-muted">Aucune dépense enregistrée</p>
			{/if}
		</div>

		<!-- Category breakdown by area -->
		{#if categoryData.length > 0}
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<h2 class="mb-3 text-lg font-semibold text-text-primary">Détail par type de dépense</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each Object.entries(categoryByArea) as [area, items]}
						<div class="rounded-lg border border-border/50 p-3">
							<h3 class="mb-2 text-sm font-semibold" style="color: {AREA_COLORS[area] ?? '#94a3b8'}">
								{BUDGET_AREA_LABELS[area] ?? area}
							</h3>
							<div class="space-y-1">
								{#each items as item}
									<div class="flex items-center justify-between text-sm">
										<span class="text-text-secondary truncate mr-2">{item.name}</span>
										<span class="font-medium text-text-primary whitespace-nowrap">{formatCurrency(item.total)}</span>
									</div>
								{/each}
							</div>
							<div class="mt-2 border-t border-border/50 pt-1 flex justify-between text-sm font-semibold">
								<span class="text-text-muted">Total</span>
								<span class="text-text-primary">{formatCurrency(items.reduce((s, i) => s + i.total, 0))}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
