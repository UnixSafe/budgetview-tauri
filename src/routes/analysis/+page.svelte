<script lang="ts">
	import { onMount } from 'svelte';
	import { BarChart3, TrendingUp, PieChart, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-svelte';
	import { query } from '$lib/stores/db';
	import { formatCurrency, formatMonth, BUDGET_AREA_LABELS } from '$lib/utils/format';
	import { Chart, registerables } from 'chart.js';
	import type { BudgetArea } from '$lib/types';

	Chart.register(...registerables);

	Chart.defaults.color = '#a1a1a6';
	Chart.defaults.borderColor = 'rgba(84, 84, 88, 0.2)';
	Chart.defaults.font.family = "-apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif";

	let year = $state(new Date().getFullYear());
	let loading = $state(true);

	let monthlyData = $state<{ month: number; income: number; expenses: number }[]>([]);
	let categoryData = $state<{ name: string; area: string; total: number }[]>([]);
	let topExpenses = $state<{ label: string; total: number; count: number }[]>([]);

	let forecastLabels = $state<string[]>([]);
	let forecastActual = $state<(number | null)[]>([]);
	let forecastProjected = $state<(number | null)[]>([]);

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
			const monthlyRaw = await query<{ month: number; income: number; expenses: number }>(
				`SELECT CAST(strftime('%m', date) AS INTEGER) as month,
					COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
					COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses
				FROM transactions WHERE strftime('%Y', date) = $1
				GROUP BY strftime('%m', date) ORDER BY month`, [String(year)]
			);
			monthlyData = monthlyRaw;

			categoryData = await query<{ name: string; area: string; total: number }>(
				`SELECT bs.name, bs.budget_area as area, ABS(SUM(t.amount)) as total
				FROM transactions t JOIN budget_series bs ON t.series_id = bs.id
				WHERE t.amount < 0 AND strftime('%Y', t.date) = $1
				GROUP BY bs.id ORDER BY total DESC`, [String(year)]
			);

			topExpenses = await query<{ label: string; total: number; count: number }>(
				`SELECT label, ABS(SUM(amount)) as total, COUNT(*) as count
				FROM transactions WHERE amount < 0 AND strftime('%Y', date) = $1
				GROUP BY UPPER(label) ORDER BY total DESC LIMIT 10`, [String(year)]
			);

			await loadForecast();
			renderCharts();
		} finally { loading = false; }
	}

	async function loadForecast() {
		const now = new Date();
		const currentMonth = now.getMonth() + 1;
		const currentYear = now.getFullYear();

		const balResult = await query<{ total: number }>(
			`SELECT COALESCE(SUM(a.initial_balance), 0) + COALESCE((SELECT SUM(t.amount) FROM transactions t JOIN accounts a2 ON t.account_id = a2.id WHERE a2.is_active = 1), 0) as total
			 FROM accounts a WHERE a.is_active = 1`
		);
		let currentBalance = balResult[0]?.total ?? 0;

		const labels: string[] = [];
		const actual: (number | null)[] = [];
		const projected: (number | null)[] = [];

		for (let offset = -3; offset <= 6; offset++) {
			let m = currentMonth + offset;
			let y = currentYear;
			while (m <= 0) { m += 12; y--; }
			while (m > 12) { m -= 12; y++; }

			labels.push(new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(new Date(y, m - 1)));

			if (offset < 0) {
				actual.push(null);
				projected.push(null);
			} else if (offset === 0) {
				actual.push(currentBalance);
				projected.push(currentBalance);
			} else {
				const budgetNet = await query<{ net: number }>(
					`SELECT COALESCE(SUM(CASE WHEN bs.budget_area = 'income' THEN mb.planned_amount ELSE -ABS(mb.planned_amount) END), 0) as net
					FROM monthly_budget mb JOIN budget_series bs ON mb.series_id = bs.id WHERE mb.year = $1 AND mb.month = $2`, [y, m]
				);
				const recurringNet = await query<{ net: number }>(
					`SELECT COALESCE(SUM(r.amount), 0) as net FROM recurring_transactions r WHERE r.is_active = 1 AND r.frequency = 'monthly' AND r.series_id IS NULL`, []
				);
				currentBalance += (budgetNet[0]?.net ?? 0) + (recurringNet[0]?.net ?? 0);
				actual.push(null);
				projected.push(currentBalance);
			}
		}

		let bal = actual[3]!;
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
				`SELECT COALESCE(SUM(amount), 0) as net FROM transactions WHERE date >= $1 AND date < $2`, [startDate, endDate]
			);
			bal -= netResult[0]?.net ?? 0;
			actual[i] = bal;
		}

		forecastLabels = labels;
		forecastActual = actual;
		forecastProjected = projected;
	}

	const AREA_COLORS: Record<string, string> = {
		income: '#30d158', recurring: '#0a84ff', variable: '#ffd60a',
		extras: '#bf5af2', savings: '#64d2ff', transfers: '#6e6e73'
	};

	const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

	function renderCharts() {
		barChart?.destroy();
		doughnutChart?.destroy();
		lineChart?.destroy();
		forecastChart?.destroy();

		if (!barCanvas || !doughnutCanvas || !lineCanvas) return;

		const incomeByMonth = new Array(12).fill(0);
		const expensesByMonth = new Array(12).fill(0);
		for (const d of monthlyData) {
			incomeByMonth[d.month - 1] = d.income;
			expensesByMonth[d.month - 1] = d.expenses;
		}

		barChart = new Chart(barCanvas, {
			type: 'bar',
			data: {
				labels: MONTH_LABELS,
				datasets: [
					{ label: 'Revenus', data: incomeByMonth, backgroundColor: '#30d15830', borderColor: '#30d158', borderWidth: 1.5, borderRadius: 6 },
					{ label: 'Dépenses', data: expensesByMonth, backgroundColor: '#ff453a30', borderColor: '#ff453a', borderWidth: 1.5, borderRadius: 6 }
				]
			},
			options: {
				responsive: true, maintainAspectRatio: false,
				plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyleWidth: 8, padding: 16 } },
					tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}` } }
				},
				scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(Number(v)) }, grid: { color: 'rgba(84, 84, 88, 0.15)' } }, x: { grid: { display: false } } }
			}
		});

		if (categoryData.length > 0) {
			const colors = categoryData.map((c) => AREA_COLORS[c.area] ?? '#6e6e73');
			doughnutChart = new Chart(doughnutCanvas, {
				type: 'doughnut',
				data: {
					labels: categoryData.map((c) => c.name),
					datasets: [{ data: categoryData.map((c) => c.total), backgroundColor: colors.map((c) => c + '50'), borderColor: colors, borderWidth: 2 }]
				},
				options: {
					responsive: true, maintainAspectRatio: false, cutout: '65%',
					plugins: {
						legend: { position: 'right', labels: { boxWidth: 10, padding: 12, usePointStyle: true } },
						tooltip: { callbacks: { label: (ctx) => { const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0); return `${ctx.label}: ${formatCurrency(ctx.parsed)} (${((ctx.parsed / total) * 100).toFixed(1)}%)`; } } }
					}
				}
			});
		}

		const cumulativeBalance = new Array(12).fill(0);
		let running = 0;
		for (let i = 0; i < 12; i++) { running += incomeByMonth[i] - expensesByMonth[i]; cumulativeBalance[i] = running; }

		lineChart = new Chart(lineCanvas, {
			type: 'line',
			data: { labels: MONTH_LABELS, datasets: [{ label: 'Solde cumulé', data: cumulativeBalance, borderColor: '#0a84ff', backgroundColor: '#0a84ff15', fill: true, tension: 0.4, pointBackgroundColor: '#0a84ff', pointRadius: 4, pointHoverRadius: 6 }] },
			options: {
				responsive: true, maintainAspectRatio: false,
				plugins: { legend: { position: 'top', labels: { usePointStyle: true } }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}` } } },
				scales: { y: { ticks: { callback: (v) => formatCurrency(Number(v)) }, grid: { color: 'rgba(84, 84, 88, 0.15)' } }, x: { grid: { display: false } } }
			}
		});

		if (forecastCanvas && forecastLabels.length > 0) {
			forecastChart = new Chart(forecastCanvas, {
				type: 'line',
				data: {
					labels: forecastLabels,
					datasets: [
						{ label: 'Réalisé', data: forecastActual, borderColor: '#0a84ff', backgroundColor: '#0a84ff15', fill: false, tension: 0.4, pointBackgroundColor: '#0a84ff', pointRadius: 4, spanGaps: false },
						{ label: 'Prévisionnel', data: forecastProjected, borderColor: '#ff9f0a', backgroundColor: '#ff9f0a15', borderDash: [6, 4], fill: false, tension: 0.4, pointBackgroundColor: '#ff9f0a', pointRadius: 4, spanGaps: false }
					]
				},
				options: {
					responsive: true, maintainAspectRatio: false,
					plugins: { legend: { position: 'top', labels: { usePointStyle: true } }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}` } } },
					scales: { y: { ticks: { callback: (v) => formatCurrency(Number(v)) }, grid: { color: 'rgba(84, 84, 88, 0.15)' } }, x: { grid: { display: false } } }
				}
			});
		}
	}

	function prevYear() { year--; loadData(); }
	function nextYear() { year++; loadData(); }

	onMount(() => { loadData(); return () => { barChart?.destroy(); doughnutChart?.destroy(); lineChart?.destroy(); forecastChart?.destroy(); }; });

	let totalIncome = $derived(monthlyData.reduce((s, d) => s + d.income, 0));
	let totalExpenses = $derived(monthlyData.reduce((s, d) => s + d.expenses, 0));
	let balance = $derived(totalIncome - totalExpenses);

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

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Analyse</h1>
			<p class="mt-1 text-sm text-text-muted">Visualisez vos finances</p>
		</div>
		<div class="flex items-center gap-3">
			<button onclick={prevYear} class="rounded-xl p-2.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-smooth btn-press">
				<ChevronLeft size={22} />
			</button>
			<span class="text-xl font-bold text-text-primary min-w-[4rem] text-center">{year}</span>
			<button onclick={nextYear} class="rounded-xl p-2.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-smooth btn-press">
				<ChevronRight size={22} />
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<div class="h-10 w-10 animate-spin rounded-full border-[3px] border-accent/20 border-t-accent"></div>
		</div>
	{:else if monthlyData.length === 0 && categoryData.length === 0}
		<div class="flex flex-col items-center justify-center glass-card p-16">
			<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-bg-elevated">
				<BarChart3 size={36} class="text-text-muted" strokeWidth={1.5} />
			</div>
			<p class="text-xl font-semibold text-text-primary">Pas de données pour {year}</p>
			<p class="mt-1 text-sm text-text-muted">Les graphiques apparaîtront après l'import de transactions</p>
		</div>
	{:else}
		<!-- Summary -->
		<div class="grid grid-cols-3 gap-3 md:gap-4 stagger-children">
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Revenus {year}</p>
				<p class="mt-2 text-2xl font-bold tracking-tight text-income">{formatCurrency(totalIncome)}</p>
			</div>
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Dépenses {year}</p>
				<p class="mt-2 text-2xl font-bold tracking-tight text-expense">{formatCurrency(totalExpenses)}</p>
			</div>
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Balance</p>
				<p class="mt-2 text-2xl font-bold tracking-tight" class:text-income={balance >= 0} class:text-expense={balance < 0}>
					{formatCurrency(balance)}
				</p>
			</div>
		</div>

		<!-- Charts -->
		<div class="glass-card p-6">
			<div class="mb-4 flex items-center gap-2">
				<BarChart3 size={18} class="text-accent" />
				<h2 class="text-lg font-semibold text-text-primary">Revenus vs Dépenses</h2>
			</div>
			<div class="h-72"><canvas bind:this={barCanvas}></canvas></div>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div class="glass-card p-6">
				<div class="mb-4 flex items-center gap-2">
					<PieChart size={18} class="text-warning" />
					<h2 class="text-lg font-semibold text-text-primary">Par catégorie</h2>
				</div>
				{#if categoryData.length > 0}
					<div class="h-72"><canvas bind:this={doughnutCanvas}></canvas></div>
				{:else}
					<p class="py-8 text-center text-[13px] text-text-muted">Aucune transaction catégorisée</p>
				{/if}
			</div>

			<div class="glass-card p-6">
				<div class="mb-4 flex items-center gap-2">
					<TrendingUp size={18} class="text-income" />
					<h2 class="text-lg font-semibold text-text-primary">Solde cumulé</h2>
				</div>
				<div class="h-72"><canvas bind:this={lineCanvas}></canvas></div>
			</div>
		</div>

		<div class="glass-card p-6">
			<div class="mb-4 flex items-center gap-2">
				<CalendarClock size={18} class="text-orange" />
				<h2 class="text-lg font-semibold text-text-primary">Trésorerie prévisionnelle</h2>
			</div>
			<p class="mb-3 text-[12px] text-text-muted">Projection sur 6 mois basée sur le budget et les récurrences</p>
			<div class="h-72"><canvas bind:this={forecastCanvas}></canvas></div>
		</div>

		<!-- Top expenses -->
		<div class="glass-card p-6">
			<h2 class="mb-4 text-lg font-semibold text-text-primary">Top 10 des dépenses</h2>
			{#if topExpenses.length > 0}
				<div class="space-y-2">
					{#each topExpenses as expense, i}
						<div class="flex items-center gap-4 rounded-xl px-4 py-3 hover-row transition-smooth">
							<span class="flex h-7 w-7 items-center justify-center rounded-full bg-bg-elevated text-[12px] font-bold text-text-muted">{i + 1}</span>
							<div class="flex-1 min-w-0">
								<p class="text-[14px] font-medium text-text-primary truncate">{expense.label}</p>
								<p class="text-[11px] text-text-muted">{expense.count} occurrence{expense.count > 1 ? 's' : ''}</p>
							</div>
							<span class="text-[14px] font-semibold tabular-nums text-expense">{formatCurrency(expense.total)}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="py-4 text-center text-[13px] text-text-muted">Aucune dépense</p>
			{/if}
		</div>

		<!-- Category breakdown -->
		{#if categoryData.length > 0}
			<div class="glass-card p-6">
				<h2 class="mb-4 text-lg font-semibold text-text-primary">Détail par type</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each Object.entries(categoryByArea) as [area, items]}
						<div class="rounded-2xl border border-border-light p-4">
							<h3 class="mb-3 text-[13px] font-bold" style="color: {AREA_COLORS[area] ?? '#a1a1a6'}">
								{BUDGET_AREA_LABELS[area] ?? area}
							</h3>
							<div class="space-y-2">
								{#each items as item}
									<div class="flex items-center justify-between text-[13px]">
										<span class="text-text-secondary truncate mr-2">{item.name}</span>
										<span class="font-medium text-text-primary tabular-nums whitespace-nowrap">{formatCurrency(item.total)}</span>
									</div>
								{/each}
							</div>
							<div class="mt-3 border-t border-border-light pt-2 flex justify-between text-[13px] font-bold">
								<span class="text-text-muted">Total</span>
								<span class="text-text-primary tabular-nums">{formatCurrency(items.reduce((s, i) => s + i.total, 0))}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
