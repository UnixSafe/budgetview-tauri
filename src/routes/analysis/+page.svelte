<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { BarChart3, TrendingUp, PieChart, ChevronLeft, ChevronRight, CalendarClock, ArrowUpRight, ArrowDownRight, Scale, Layers, Receipt } from 'lucide-svelte';
	import { query } from '$lib/stores/db';
	import { formatCurrency, formatMonth, BUDGET_AREA_LABELS } from '$lib/utils/format';
	import { confidentialStore } from '$lib/stores/confidential.svelte';
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

			// Load previous year for YoY comparison
			const prevYearData = await query<{ income: number; expenses: number }>(
				`SELECT
					COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
					COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses
				FROM transactions WHERE strftime('%Y', date) = $1`, [String(year - 1)]
			);
			prevYearIncome = prevYearData[0]?.income ?? 0;
			prevYearExpenses = prevYearData[0]?.expenses ?? 0;

			await loadForecast();
		} finally { loading = false; }
		await tick();
		renderCharts();
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

	const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec'];

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
					{ label: 'Depenses', data: expensesByMonth, backgroundColor: '#ff453a30', borderColor: '#ff453a', borderWidth: 1.5, borderRadius: 6 }
				]
			},
			options: {
				responsive: true, maintainAspectRatio: false,
				plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyleWidth: 8, padding: 16 } },
					tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${confidentialStore.format(ctx.parsed.y ?? 0)}` } }
				},
				scales: { y: { beginAtZero: true, ticks: { callback: (v) => confidentialStore.format(Number(v)) }, grid: { color: 'rgba(84, 84, 88, 0.15)' } }, x: { grid: { display: false } } }
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
						tooltip: { callbacks: { label: (ctx) => { const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0); const pct = total === 0 ? '0.0' : ((ctx.parsed / total) * 100).toFixed(1); return confidentialStore.enabled ? `${ctx.label}: ${pct}%` : `${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`; } } }
					}
				}
			});
		}

		const cumulativeBalance = new Array(12).fill(0);
		let running = 0;
		for (let i = 0; i < 12; i++) { running += incomeByMonth[i] - expensesByMonth[i]; cumulativeBalance[i] = running; }

		lineChart = new Chart(lineCanvas, {
			type: 'line',
			data: { labels: MONTH_LABELS, datasets: [{ label: 'Solde cumule', data: cumulativeBalance, borderColor: '#0a84ff', backgroundColor: '#0a84ff15', fill: true, tension: 0.4, pointBackgroundColor: '#0a84ff', pointRadius: 4, pointHoverRadius: 6 }] },
			options: {
				responsive: true, maintainAspectRatio: false,
				plugins: { legend: { position: 'top', labels: { usePointStyle: true } }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${confidentialStore.format(ctx.parsed.y ?? 0)}` } } },
				scales: { y: { ticks: { callback: (v) => confidentialStore.format(Number(v)) }, grid: { color: 'rgba(84, 84, 88, 0.15)' } }, x: { grid: { display: false } } }
			}
		});

		if (forecastCanvas && forecastLabels.length > 0) {
			forecastChart = new Chart(forecastCanvas, {
				type: 'line',
				data: {
					labels: forecastLabels,
					datasets: [
						{ label: 'Realise', data: forecastActual, borderColor: '#0a84ff', backgroundColor: '#0a84ff15', fill: false, tension: 0.4, pointBackgroundColor: '#0a84ff', pointRadius: 4, spanGaps: false },
						{ label: 'Previsionnel', data: forecastProjected, borderColor: '#ff9f0a', backgroundColor: '#ff9f0a15', borderDash: [6, 4], fill: false, tension: 0.4, pointBackgroundColor: '#ff9f0a', pointRadius: 4, spanGaps: false }
					]
				},
				options: {
					responsive: true, maintainAspectRatio: false,
					plugins: { legend: { position: 'top', labels: { usePointStyle: true } }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${confidentialStore.format(ctx.parsed.y ?? 0)}` } } },
					scales: { y: { ticks: { callback: (v) => confidentialStore.format(Number(v)) }, grid: { color: 'rgba(84, 84, 88, 0.15)' } }, x: { grid: { display: false } } }
				}
			});
		}
	}

	function prevYear() { year--; loadData(); }
	function nextYear() { year++; loadData(); }

	onMount(() => { loadData(); return () => { barChart?.destroy(); doughnutChart?.destroy(); lineChart?.destroy(); forecastChart?.destroy(); }; });

	// Re-render charts when confidential mode toggles
	$effect(() => {
		confidentialStore.enabled;
		if (!loading && barCanvas) renderCharts();
	});

	let totalIncome = $derived(monthlyData.reduce((s, d) => s + d.income, 0));
	let totalExpenses = $derived(monthlyData.reduce((s, d) => s + d.expenses, 0));
	let balance = $derived(totalIncome - totalExpenses);

	// Year-over-year comparison
	let prevYearIncome = $state(0);
	let prevYearExpenses = $state(0);
	let yoyIncomeChange = $derived(prevYearIncome === 0 ? 0 : ((totalIncome - prevYearIncome) / prevYearIncome) * 100);
	let yoyExpenseChange = $derived(prevYearExpenses === 0 ? 0 : ((totalExpenses - prevYearExpenses) / prevYearExpenses) * 100);

	let categoryByArea = $derived.by(() => {
		const groups: Record<string, { name: string; total: number }[]> = {};
		for (const c of categoryData) {
			if (!groups[c.area]) groups[c.area] = [];
			groups[c.area].push({ name: c.name, total: c.total });
		}
		return groups;
	});

	let totalCategoryExpenses = $derived(categoryData.reduce((s, c) => s + c.total, 0));
</script>

<svelte:head>
	<title>Analyse — BudgetView</title>
</svelte:head>

<div class="space-y-8 animate-fade-in">
	<!-- Header with year navigation -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-headline text-text-primary">Analyse</h1>
			<p class="mt-1.5 text-body text-text-muted">Visualisez vos finances en un coup d'oeil</p>
		</div>

		<!-- Prominent year navigation -->
		<div class="glass-card-sm flex items-center gap-1 px-2 py-1.5">
			<button onclick={prevYear}
				class="rounded-xl p-2.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-smooth btn-press">
				<ChevronLeft size={20} strokeWidth={2.5} />
			</button>
			<span class="text-display text-text-primary min-w-[5.5rem] text-center text-[1.75rem]">{year}</span>
			<button onclick={nextYear}
				class="rounded-xl p-2.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-smooth btn-press">
				<ChevronRight size={20} strokeWidth={2.5} />
			</button>
		</div>
	</div>

	{#if loading}
		<!-- Skeleton loading state -->
		<div class="grid grid-cols-3 gap-4 stagger-children">
			<div class="glass-card p-6"><div class="skeleton skeleton-text-sm mb-3"></div><div class="skeleton skeleton-text"></div></div>
			<div class="glass-card p-6"><div class="skeleton skeleton-text-sm mb-3"></div><div class="skeleton skeleton-text"></div></div>
			<div class="glass-card p-6"><div class="skeleton skeleton-text-sm mb-3"></div><div class="skeleton skeleton-text"></div></div>
		</div>
		<div class="skeleton skeleton-card"></div>
		<div class="grid grid-cols-2 gap-6">
			<div class="skeleton skeleton-card"></div>
			<div class="skeleton skeleton-card"></div>
		</div>
	{:else if monthlyData.length === 0 && categoryData.length === 0}
		<!-- Elegant empty state -->
		<div class="flex flex-col items-center justify-center glass-card py-24 px-8">
			<div class="relative mb-8">
				<div class="flex h-24 w-24 items-center justify-center rounded-[28px] bg-bg-elevated animate-float">
					<BarChart3 size={40} class="text-text-muted" strokeWidth={1.5} />
				</div>
				<div class="absolute -top-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
					<TrendingUp size={18} class="text-accent" strokeWidth={2} />
				</div>
				<div class="absolute -bottom-1 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-warning/10">
					<PieChart size={14} class="text-warning" strokeWidth={2} />
				</div>
			</div>
			<p class="text-title text-text-primary mb-2">Pas de donnees pour {year}</p>
			<p class="text-body text-text-muted text-center max-w-sm">
				Importez des transactions pour voir apparaitre vos graphiques d'analyse et statistiques detaillees.
			</p>
		</div>
	{:else}
		<!-- Summary cards -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3 stagger-children">
			<div class="glass-card p-6 card-hover">
				<div class="flex items-center gap-3 mb-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-income/10">
						<ArrowUpRight size={20} class="text-income" strokeWidth={2} />
					</div>
					<p class="text-caption text-text-muted uppercase tracking-wider">Revenus {year}</p>
				</div>
				<p class="text-[1.75rem] font-bold tracking-tight text-income tabular-nums">{confidentialStore.format(totalIncome)}</p>
				{#if prevYearIncome > 0}
					<p class="mt-1 text-[11px] font-medium tabular-nums {yoyIncomeChange >= 0 ? 'text-income' : 'text-expense'}">
						{yoyIncomeChange >= 0 ? '+' : ''}{yoyIncomeChange.toFixed(0)}% vs {year - 1}
					</p>
				{/if}
			</div>
			<div class="glass-card p-6 card-hover">
				<div class="flex items-center gap-3 mb-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-expense/10">
						<ArrowDownRight size={20} class="text-expense" strokeWidth={2} />
					</div>
					<p class="text-caption text-text-muted uppercase tracking-wider">Depenses {year}</p>
				</div>
				<p class="text-[1.75rem] font-bold tracking-tight text-expense tabular-nums">{confidentialStore.format(totalExpenses)}</p>
				{#if prevYearExpenses > 0}
					<p class="mt-1 text-[11px] font-medium tabular-nums {yoyExpenseChange <= 0 ? 'text-income' : 'text-expense'}">
						{yoyExpenseChange >= 0 ? '+' : ''}{yoyExpenseChange.toFixed(0)}% vs {year - 1}
					</p>
				{/if}
			</div>
			<div class="glass-card p-6 card-hover">
				<div class="flex items-center gap-3 mb-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-2xl {balance >= 0 ? 'bg-income/10' : 'bg-expense/10'}">
						<Scale size={20} class={balance >= 0 ? 'text-income' : 'text-expense'} strokeWidth={2} />
					</div>
					<p class="text-caption text-text-muted uppercase tracking-wider">Balance</p>
				</div>
				<p class="text-[1.75rem] font-bold tracking-tight tabular-nums" class:text-income={balance >= 0} class:text-expense={balance < 0}>
					{confidentialStore.format(balance)}
				</p>
			</div>
		</div>

		<!-- Revenue vs Expenses chart -->
		<div class="glass-card p-7 animate-slide-up">
			<div class="mb-5 flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
					<BarChart3 size={18} class="text-accent" strokeWidth={2} />
				</div>
				<div>
					<h2 class="text-title text-text-primary">Revenus vs Depenses</h2>
					<p class="text-caption text-text-muted">Comparaison mensuelle sur l'annee</p>
				</div>
			</div>
			<div class="h-80"><canvas bind:this={barCanvas}></canvas></div>
		</div>

		<!-- Doughnut + Line charts grid -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div class="glass-card p-7 animate-slide-up" style="animation-delay: 60ms;">
				<div class="mb-5 flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10">
						<PieChart size={18} class="text-warning" strokeWidth={2} />
					</div>
					<div>
						<h2 class="text-title text-text-primary">Par categorie</h2>
						<p class="text-caption text-text-muted">Repartition des depenses</p>
					</div>
				</div>
				{#if categoryData.length > 0}
					<div class="h-72"><canvas bind:this={doughnutCanvas}></canvas></div>
				{:else}
					<div class="flex flex-col items-center justify-center py-12">
						<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated mb-3">
							<PieChart size={24} class="text-text-muted" strokeWidth={1.5} />
						</div>
						<p class="text-body text-text-muted">Aucune transaction categorisee</p>
					</div>
				{/if}
			</div>

			<div class="glass-card p-7 animate-slide-up" style="animation-delay: 120ms;">
				<div class="mb-5 flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-income/10">
						<TrendingUp size={18} class="text-income" strokeWidth={2} />
					</div>
					<div>
						<h2 class="text-title text-text-primary">Solde cumule</h2>
						<p class="text-caption text-text-muted">Evolution sur l'annee</p>
					</div>
				</div>
				<div class="h-72"><canvas bind:this={lineCanvas}></canvas></div>
			</div>
		</div>

		<!-- Forecast chart -->
		<div class="glass-card p-7 animate-slide-up" style="animation-delay: 180ms;">
			<div class="mb-5 flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-orange/10">
					<CalendarClock size={18} class="text-orange" strokeWidth={2} />
				</div>
				<div>
					<h2 class="text-title text-text-primary">Tresorerie previsionnelle</h2>
					<p class="text-caption text-text-muted">Projection sur 6 mois basee sur le budget et les recurrences</p>
				</div>
			</div>
			<div class="h-80"><canvas bind:this={forecastCanvas}></canvas></div>
		</div>

		<!-- Top expenses table -->
		<div class="glass-card overflow-hidden animate-slide-up" style="animation-delay: 240ms;">
			<div class="p-7 pb-4 flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-expense/10">
					<Receipt size={18} class="text-expense" strokeWidth={2} />
				</div>
				<div>
					<h2 class="text-title text-text-primary">Top 10 des depenses</h2>
					<p class="text-caption text-text-muted">Vos plus gros postes de depenses en {year}</p>
				</div>
			</div>
			{#if topExpenses.length > 0}
				<div class="px-4 pb-4">
					<table class="w-full">
						<thead>
							<tr class="text-caption text-text-muted uppercase tracking-wider">
								<th class="px-3 py-3 text-left font-medium w-12">#</th>
								<th class="px-3 py-3 text-left font-medium">Libelle</th>
								<th class="px-3 py-3 text-right font-medium">Occurrences</th>
								<th class="px-3 py-3 text-right font-medium">Total</th>
							</tr>
						</thead>
						<tbody class="stagger-children">
							{#each topExpenses as expense, i}
								<tr class="hover-row group cursor-default rounded-xl">
									<td class="px-3 py-3.5 rounded-l-xl">
										<span class="flex h-7 w-7 items-center justify-center rounded-full bg-bg-elevated text-[12px] font-bold text-text-muted
											group-hover:bg-accent/10 group-hover:text-accent transition-smooth">
											{i + 1}
										</span>
									</td>
									<td class="px-3 py-3.5">
										<p class="text-[14px] font-medium text-text-primary truncate max-w-[280px]">{expense.label}</p>
									</td>
									<td class="px-3 py-3.5 text-right">
										<span class="badge bg-bg-elevated text-text-muted">{expense.count}x</span>
									</td>
									<td class="px-3 py-3.5 text-right rounded-r-xl">
										<span class="text-[14px] font-semibold tabular-nums text-expense">{confidentialStore.format(expense.total)}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center py-12 px-4">
					<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated mb-3">
						<Receipt size={24} class="text-text-muted" strokeWidth={1.5} />
					</div>
					<p class="text-body text-text-muted">Aucune depense enregistree</p>
				</div>
			{/if}
		</div>

		<!-- Category breakdown -->
		{#if categoryData.length > 0}
			<div class="glass-card p-7 animate-slide-up" style="animation-delay: 300ms;">
				<div class="mb-6 flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-purple/10">
						<Layers size={18} class="text-purple" strokeWidth={2} />
					</div>
					<div>
						<h2 class="text-title text-text-primary">Detail par type</h2>
						<p class="text-caption text-text-muted">Repartition par categorie budgetaire</p>
					</div>
				</div>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
					{#each Object.entries(categoryByArea) as [area, items]}
						{@const areaColor = AREA_COLORS[area] ?? '#a1a1a6'}
						{@const areaTotal = items.reduce((s, i) => s + i.total, 0)}
						<div class="glass-card-sm p-5 card-hover" style="border-left: 3px solid {areaColor};">
							<div class="flex items-center justify-between mb-4">
								<h3 class="text-[13px] font-bold" style="color: {areaColor}">
									{BUDGET_AREA_LABELS[area] ?? area}
								</h3>
								{#if totalCategoryExpenses > 0}
									<span class="badge text-text-muted" style="background: {areaColor}15; color: {areaColor};">
										{((areaTotal / totalCategoryExpenses) * 100).toFixed(0)}%
									</span>
								{/if}
							</div>
							<div class="space-y-2.5">
								{#each items as item}
									<div class="flex items-center justify-between text-[13px]">
										<span class="text-text-secondary truncate mr-3">{item.name}</span>
										<span class="font-medium text-text-primary tabular-nums whitespace-nowrap">{confidentialStore.format(item.total)}</span>
									</div>
								{/each}
							</div>
							<div class="divider my-3"></div>
							<div class="flex justify-between text-[13px] font-bold">
								<span class="text-text-muted">Total</span>
								<span class="text-text-primary tabular-nums">{confidentialStore.format(areaTotal)}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
