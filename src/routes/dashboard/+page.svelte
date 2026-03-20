<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { Wallet, TrendingUp, TrendingDown, ArrowLeftRight, Landmark, Tag, ChevronRight, AlertCircle, Clock, ShieldAlert, Sun, CloudRain, Cloud } from 'lucide-svelte';
	import { formatCurrency, ACCOUNT_TYPE_LABELS } from '$lib/utils/format';
	import { confidentialStore } from '$lib/stores/confidential.svelte';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { query } from '$lib/stores/db';
	import type { DashboardSummary, BudgetLineItem, MissingRecurrence } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import OnboardingGuide from '$lib/components/OnboardingGuide.svelte';
	import CashFlowChart from '$lib/components/CashFlowChart.svelte';
	import BudgetHealthGauge from '$lib/components/BudgetHealthGauge.svelte';
	import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';

	let loading = $state(true);
	let error = $state<string | null>(null);

	let summary = $state<DashboardSummary>({
		total_balance: 0,
		month_income: 0,
		month_expenses: 0,
		transaction_count: 0
	});

	let uncategorizedCount = $state(0);
	let recentTransactions = $state<{ date: string; label: string; amount: number; account_name: string }[]>([]);
	let cashFlowData = $state<{ label: string; income: number; expenses: number; net: number }[]>([]);
	let missingRecurrences = $state<MissingRecurrence[]>([]);
	let overBudgetLines = $state<BudgetLineItem[]>([]);
	let dailySpending = $state<{ day: string; amount: number }[]>([]);
	let topCategories = $state<{ name: string; total: number; color: string }[]>([]);
	let prevMonthIncome = $state(0);
	let prevMonthExpenses = $state(0);

	let currentMonthLabel = $derived(
		new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date())
	);

	let netBalance = $derived(summary.month_income + summary.month_expenses);

	onMount(async () => {
		try {
			await accountStore.load();
			await budgetStore.loadBudgetView();

			const now = new Date();
			const year = now.getFullYear();
			const month = now.getMonth() + 1;
			const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
			const endMonth = month === 12 ? 1 : month + 1;
			const endYear = month === 12 ? year + 1 : year;
			const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

			const [incomeResult, expenseResult, countResult, recent, uncatResult] = await Promise.all([
				query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date >= $1 AND date < $2 AND amount > 0', [startDate, endDate]),
				query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date >= $1 AND date < $2 AND amount < 0', [startDate, endDate]),
				query<{ count: number }>('SELECT COUNT(*) as count FROM transactions WHERE date >= $1 AND date < $2', [startDate, endDate]),
				query<{ date: string; label: string; amount: number; account_name: string }>(
					`SELECT t.date, t.label, t.amount, a.name as account_name
					 FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id
					 ORDER BY t.date DESC, t.id DESC LIMIT 10`
				),
				query<{ count: number }>('SELECT COUNT(*) as count FROM transactions WHERE series_id IS NULL')
			]);

			summary = {
				total_balance: accountStore.totalBalance,
				month_income: incomeResult[0]?.total ?? 0,
				month_expenses: expenseResult[0]?.total ?? 0,
				transaction_count: countResult[0]?.count ?? 0
			};

			recentTransactions = recent;
			uncategorizedCount = uncatResult[0]?.count ?? 0;

			// Load previous month for comparison
			const prevMonth = month === 1 ? 12 : month - 1;
			const prevYear = month === 1 ? year - 1 : year;
			const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
			const prevEndM = prevMonth === 12 ? 1 : prevMonth + 1;
			const prevEndY = prevMonth === 12 ? prevYear + 1 : prevYear;
			const prevEnd = `${prevEndY}-${String(prevEndM).padStart(2, '0')}-01`;
			const [prevInc, prevExp] = await Promise.all([
				query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date >= $1 AND date < $2 AND amount > 0', [prevStart, prevEnd]),
				query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date >= $1 AND date < $2 AND amount < 0', [prevStart, prevEnd]),
			]);
			prevMonthIncome = prevInc[0]?.total ?? 0;
			prevMonthExpenses = prevExp[0]?.total ?? 0;

			// Load cash flow chart data (last 6 months)
			await loadCashFlowData();

			// Detect over-budget categories
			overBudgetLines = budgetStore.budgetLines.filter((l: BudgetLineItem) =>
				l.budget_area !== 'income' &&
				l.planned_amount !== 0 &&
				Math.abs(l.actual_amount) > Math.abs(l.planned_amount)
			);

			// Load top spending categories this month
			try {
				const AREA_COLORS: Record<string, string> = {
					income: '#30d158', recurring: '#0a84ff', variable: '#ffd60a',
					extras: '#bf5af2', savings: '#64d2ff', transfers: '#6e6e73'
				};
				const cats = await query<{ name: string; area: string; total: number }>(
					`SELECT bs.name, bs.budget_area as area, ABS(SUM(t.amount)) as total
					 FROM transactions t JOIN budget_series bs ON t.series_id = bs.id
					 WHERE t.amount < 0 AND t.date >= $1 AND t.date < $2
					 GROUP BY bs.id ORDER BY total DESC LIMIT 5`,
					[startDate, endDate]
				);
				topCategories = cats.map(c => ({
					name: c.name,
					total: c.total,
					color: AREA_COLORS[c.area] ?? '#6e6e73'
				}));
			} catch { /* ignore */ }

			// Load daily spending for last 14 days
			try {
				const days: { day: string; amount: number }[] = [];
				for (let d = 13; d >= 0; d--) {
					const date = new Date();
					date.setDate(date.getDate() - d);
					const dateStr = date.toISOString().slice(0, 10);
					const result = await query<{ total: number }>(
						'SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions WHERE date = $1 AND amount < 0',
						[dateStr]
					);
					const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' }).format(date);
					days.push({ day: dayLabel, amount: result[0]?.total ?? 0 });
				}
				dailySpending = days;
			} catch { /* ignore */ }

			// Load missing recurrences
			try {
				missingRecurrences = await invoke<MissingRecurrence[]>('check_missing_recurrences');
			} catch { /* recurring module may not exist yet */ }
		} catch (e) {
			error = e instanceof Error ? e.message : 'Erreur inconnue';
		} finally {
			loading = false;
		}
	});

	async function loadCashFlowData() {
		const now = new Date();
		const months: { label: string; income: number; expenses: number; net: number }[] = [];

		for (let offset = -5; offset <= 0; offset++) {
			let m = now.getMonth() + 1 + offset;
			let y = now.getFullYear();
			while (m <= 0) { m += 12; y--; }
			while (m > 12) { m -= 12; y++; }

			const start = `${y}-${String(m).padStart(2, '0')}-01`;
			const endM = m === 12 ? 1 : m + 1;
			const endY = m === 12 ? y + 1 : y;
			const end = `${endY}-${String(endM).padStart(2, '0')}-01`;

			const label = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(y, m - 1));

			const [inc, exp] = await Promise.all([
				query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date >= $1 AND date < $2 AND amount > 0', [start, end]),
				query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date >= $1 AND date < $2 AND amount < 0', [start, end]),
			]);

			const income = inc[0]?.total ?? 0;
			const expenses = exp[0]?.total ?? 0;
			months.push({ label, income, expenses: Math.abs(expenses), net: income + expenses });
		}

		cashFlowData = months;
	}

	function formatDateShort(dateStr: string) {
		const d = new Date(dateStr);
		return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
	}
</script>

<svelte:head>
	<title>Tableau de bord — BudgetView</title>
</svelte:head>

<div class="space-y-8">
	<!-- Header with budget weather -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Bonjour</h1>
			<p class="mt-1 text-base text-text-muted capitalize">{currentMonthLabel}</p>
		</div>
		{#if !loading && budgetStore.budgetLines.length > 0}
			{@const expenseLines = budgetStore.budgetLines.filter((l) => l.budget_area !== 'income' && l.planned_amount !== 0)}
			{@const totalPlanned = expenseLines.reduce((s, l) => s + Math.abs(l.planned_amount), 0)}
			{@const totalSpent = expenseLines.reduce((s, l) => s + Math.abs(l.actual_amount), 0)}
			{@const pct = totalPlanned === 0 ? 0 : (totalSpent / totalPlanned) * 100}
			<div class="glass-card-sm px-4 py-3 flex items-center gap-3">
				{#if pct <= 70}
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-income/10">
						<Sun size={20} class="text-income" strokeWidth={1.8} />
					</div>
					<div>
						<p class="text-[12px] font-semibold text-income">Budget au beau fixe</p>
						<p class="text-[11px] text-text-muted">{Math.round(pct)}% utilisé</p>
					</div>
				{:else if pct <= 100}
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
						<Cloud size={20} class="text-warning" strokeWidth={1.8} />
					</div>
					<div>
						<p class="text-[12px] font-semibold text-warning">Vigilance budget</p>
						<p class="text-[11px] text-text-muted">{Math.round(pct)}% utilisé</p>
					</div>
				{:else}
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-expense/10">
						<CloudRain size={20} class="text-expense" strokeWidth={1.8} />
					</div>
					<div>
						<p class="text-[12px] font-semibold text-expense">Budget dépassé</p>
						<p class="text-[11px] text-text-muted">{Math.round(pct)}% utilisé</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<OnboardingGuide />

	{#if error}
		<ErrorBanner message={error} ondismiss={() => (error = null)} />
	{/if}

	{#if loading}
		<LoadingSpinner message="Chargement du tableau de bord..." />
	{:else}

	<!-- Summary cards -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 stagger-children">
		<div class="glass-card p-5">
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/12">
				<Wallet size={20} class="text-accent" strokeWidth={1.8} />
			</div>
			<p class="text-[12px] font-medium text-text-muted uppercase tracking-wide">Solde total</p>
			<p class="mt-1 text-2xl font-bold tracking-tight text-text-primary"><AnimatedNumber value={summary.total_balance} /></p>
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-income/12">
				<TrendingUp size={20} class="text-income" strokeWidth={1.8} />
			</div>
			<p class="text-[12px] font-medium text-text-muted uppercase tracking-wide">Revenus</p>
			<p class="mt-1 text-2xl font-bold tracking-tight text-income"><AnimatedNumber value={summary.month_income} /></p>
			{#if prevMonthIncome > 0}
				{@const pctChange = ((summary.month_income - prevMonthIncome) / prevMonthIncome) * 100}
				<p class="mt-1 text-[10px] font-medium tabular-nums {pctChange >= 0 ? 'text-income' : 'text-expense'}">
					{pctChange >= 0 ? '+' : ''}{pctChange.toFixed(0)}% vs mois dernier
				</p>
			{/if}
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-expense/12">
				<TrendingDown size={20} class="text-expense" strokeWidth={1.8} />
			</div>
			<p class="text-[12px] font-medium text-text-muted uppercase tracking-wide">Dépenses</p>
			<p class="mt-1 text-2xl font-bold tracking-tight text-expense"><AnimatedNumber value={summary.month_expenses} /></p>
			{#if prevMonthExpenses !== 0}
				{@const absChange = Math.abs(summary.month_expenses) - Math.abs(prevMonthExpenses)}
				{@const pctChange = (absChange / Math.abs(prevMonthExpenses)) * 100}
				<p class="mt-1 text-[10px] font-medium tabular-nums {pctChange <= 0 ? 'text-income' : 'text-expense'}">
					{pctChange >= 0 ? '+' : ''}{pctChange.toFixed(0)}% vs mois dernier
				</p>
			{/if}
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-purple/12">
				<ArrowLeftRight size={20} class="text-purple" strokeWidth={1.8} />
			</div>
			<p class="text-[12px] font-medium text-text-muted uppercase tracking-wide">Transactions</p>
			<p class="mt-1 text-2xl font-bold tracking-tight text-text-primary">{summary.transaction_count}</p>
		</div>
	</div>

	<!-- Alerts section -->
	<div class="space-y-3">
		{#if uncategorizedCount > 0}
			<a href="/transactions" class="group flex items-center gap-4 glass-card-sm p-4 border-l-[3px] border-l-warning transition-smooth hover:bg-bg-hover/30 btn-press">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
					<Tag size={18} class="text-warning" strokeWidth={1.8} />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-[13px] font-semibold text-text-primary">{uncategorizedCount} transaction{uncategorizedCount > 1 ? 's' : ''} non catégorisée{uncategorizedCount > 1 ? 's' : ''}</p>
					<p class="text-[11px] text-text-muted">Catégorisez pour un suivi précis</p>
				</div>
				<ChevronRight size={16} class="text-text-muted/50 group-hover:text-warning transition-smooth" />
			</a>
		{/if}

		{#if overBudgetLines.length > 0}
			<a href="/budget" class="group flex items-center gap-4 glass-card-sm p-4 border-l-[3px] border-l-danger transition-smooth hover:bg-bg-hover/30 btn-press">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10">
					<AlertCircle size={18} class="text-danger" strokeWidth={1.8} />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-[13px] font-semibold text-text-primary">{overBudgetLines.length} catégorie{overBudgetLines.length > 1 ? 's' : ''} en dépassement</p>
					<p class="text-[11px] text-text-muted truncate">{overBudgetLines.map(l => l.series_name).join(', ')}</p>
				</div>
				<ChevronRight size={16} class="text-text-muted/50 group-hover:text-danger transition-smooth" />
			</a>
		{/if}

		{#if missingRecurrences.length > 0}
			<a href="/recurring" class="group flex items-center gap-4 glass-card-sm p-4 border-l-[3px] border-l-orange transition-smooth hover:bg-bg-hover/30 btn-press">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange/10">
					<Clock size={18} class="text-orange" strokeWidth={1.8} />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-[13px] font-semibold text-text-primary">{missingRecurrences.length} récurrence{missingRecurrences.length > 1 ? 's' : ''} manquante{missingRecurrences.length > 1 ? 's' : ''}</p>
					<p class="text-[11px] text-text-muted truncate">{missingRecurrences.map(r => r.label).join(', ')}</p>
				</div>
				<ChevronRight size={16} class="text-text-muted/50 group-hover:text-orange transition-smooth" />
			</a>
		{/if}

		{#if accountStore.lowBalanceAlerts.length > 0}
			<a href="/accounts" class="group flex items-center gap-4 glass-card-sm p-4 border-l-[3px] border-l-expense transition-smooth hover:bg-bg-hover/30 btn-press">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-expense/10">
					<ShieldAlert size={18} class="text-expense" strokeWidth={1.8} />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-[13px] font-semibold text-text-primary">Solde bas</p>
					<p class="text-[11px] text-text-muted truncate">
						{accountStore.lowBalanceAlerts.map(a => `${a.name}: ${confidentialStore.format(a.computed_balance)}`).join(', ')}
					</p>
				</div>
				<ChevronRight size={16} class="text-text-muted/50 group-hover:text-expense transition-smooth" />
			</a>
		{/if}
	</div>

	<!-- Daily spending mini chart -->
	{#if dailySpending.some(d => d.amount > 0)}
		{@const maxSpend = Math.max(...dailySpending.map(d => d.amount), 1)}
		<div class="glass-card p-5">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-[13px] font-semibold text-text-secondary">Dépenses quotidiennes</h2>
				<span class="text-[11px] text-text-muted">14 derniers jours</span>
			</div>
			<div class="flex items-end gap-[3px]" style="height: 48px;">
				{#each dailySpending as day, i}
					{@const h = day.amount === 0 ? 2 : Math.max((day.amount / maxSpend) * 44, 4)}
					{@const isToday = i === dailySpending.length - 1}
					<div class="flex flex-1 flex-col items-center gap-1">
						<div
							class="w-full rounded-t-sm transition-all duration-300 {isToday ? 'bg-accent' : 'bg-text-muted/20'}"
							style="height: {h}px;"
							title={confidentialStore.format(day.amount)}
						></div>
					</div>
				{/each}
			</div>
			<div class="flex gap-[3px] mt-1">
				{#each dailySpending as day, i}
					{@const isToday = i === dailySpending.length - 1}
					<div class="flex-1 text-center text-[8px] {isToday ? 'text-accent font-bold' : 'text-text-muted/50'}">{day.day}</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Cash flow chart -->
	{#if cashFlowData.some(d => d.income > 0 || d.expenses > 0)}
		<div class="glass-card p-6">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold tracking-tight text-text-primary">Flux de trésorerie</h2>
				<div class="flex items-center gap-2">
					<span class="text-[12px] font-medium tabular-nums {netBalance >= 0 ? 'text-income' : 'text-expense'}">
						{netBalance >= 0 ? '+' : ''}{confidentialStore.format(netBalance)} ce mois
					</span>
				</div>
			</div>
			<CashFlowChart data={cashFlowData} />
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Accounts -->
		<div class="glass-card p-6">
			<div class="mb-5 flex items-center justify-between">
				<h2 class="text-lg font-semibold tracking-tight text-text-primary">Comptes</h2>
				<a href="/accounts" class="text-[12px] font-medium text-accent hover:text-accent-hover transition-smooth">Voir tout</a>
			</div>
			{#if accountStore.accounts.length === 0}
				<div class="flex flex-col items-center py-8">
					<div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated">
						<Landmark size={24} class="text-text-muted" strokeWidth={1.5} />
					</div>
					<p class="text-sm font-medium text-text-secondary">Aucun compte</p>
					<p class="mt-0.5 text-[12px] text-text-muted">Ajoutez votre premier compte pour commencer</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each accountStore.accounts as account}
						<div class="flex items-center justify-between rounded-xl p-3 transition-smooth hover:bg-bg-hover">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
									<Landmark size={18} class="text-accent" strokeWidth={1.8} />
								</div>
								<div>
									<p class="text-[14px] font-medium text-text-primary">{account.name}</p>
									<p class="text-[11px] text-text-muted">{ACCOUNT_TYPE_LABELS[account.account_type]}</p>
								</div>
							</div>
							<span class="text-[14px] font-semibold tabular-nums {account.computed_balance >= 0 ? 'text-income' : 'text-expense'}">
								{confidentialStore.format(account.computed_balance)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Recent transactions -->
		<div class="glass-card p-6">
			<div class="mb-5 flex items-center justify-between">
				<h2 class="text-lg font-semibold tracking-tight text-text-primary">Dernières transactions</h2>
				<a href="/transactions" class="text-[12px] font-medium text-accent hover:text-accent-hover transition-smooth">Voir tout</a>
			</div>
			{#if recentTransactions.length === 0}
				<div class="flex flex-col items-center py-8">
					<div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated">
						<ArrowLeftRight size={24} class="text-text-muted" strokeWidth={1.5} />
					</div>
					<p class="text-sm font-medium text-text-secondary">Aucune transaction</p>
					<p class="mt-0.5 text-[12px] text-text-muted">Importez vos relevés bancaires</p>
				</div>
			{:else}
				<div class="space-y-1">
					{#each recentTransactions as tx}
						<div class="flex items-center justify-between rounded-xl px-3 py-2.5 transition-smooth hover:bg-bg-hover">
							<div class="min-w-0 flex-1">
								<p class="text-[13px] font-medium text-text-primary truncate">{tx.label}</p>
								<p class="text-[11px] text-text-muted">{tx.account_name} · {formatDateShort(tx.date)}</p>
							</div>
							<span class="ml-3 text-[13px] font-semibold tabular-nums whitespace-nowrap {tx.amount >= 0 ? 'text-income' : 'text-expense'}">
								{confidentialStore.format(tx.amount)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Top spending categories -->
	{#if topCategories.length > 0}
		{@const totalSpending = topCategories.reduce((s, c) => s + c.total, 0)}
		<div class="glass-card p-6">
			<div class="mb-5 flex items-center justify-between">
				<h2 class="text-lg font-semibold tracking-tight text-text-primary">Top dépenses</h2>
				<a href="/analysis" class="text-[12px] font-medium text-accent hover:text-accent-hover transition-smooth">Analyse</a>
			</div>
			<div class="space-y-3">
				{#each topCategories as cat}
					{@const pct = totalSpending === 0 ? 0 : (cat.total / totalSpending) * 100}
					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<span class="text-[13px] font-medium text-text-primary">{cat.name}</span>
							<span class="text-[13px] font-semibold tabular-nums text-text-secondary">{confidentialStore.format(cat.total * -1)}</span>
						</div>
						<div class="h-[5px] w-full rounded-full bg-bg-elevated overflow-hidden">
							<div
								class="h-full rounded-full progress-bar"
								style="width: {pct}%; background-color: {cat.color};"
							></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Budget health -->
	{#if budgetStore.budgetLines.length > 0}
		<div class="glass-card p-6">
			<div class="mb-5 flex items-center justify-between">
				<h2 class="text-lg font-semibold tracking-tight text-text-primary">Santé du budget</h2>
				<a href="/budget" class="text-[12px] font-medium text-accent hover:text-accent-hover transition-smooth">Détails</a>
			</div>

			<!-- Overall budget gauge -->
			{#if true}
			{@const totalPlanned = budgetStore.budgetLines.filter((l: BudgetLineItem) => l.budget_area !== 'income' && l.planned_amount !== 0).reduce((sum: number, l: BudgetLineItem) => sum + Math.abs(l.planned_amount), 0)}
			{@const totalSpent = budgetStore.budgetLines.filter((l: BudgetLineItem) => l.budget_area !== 'income' && l.planned_amount !== 0).reduce((sum: number, l: BudgetLineItem) => sum + Math.abs(l.actual_amount), 0)}
			{@const overallPct = totalPlanned === 0 ? 0 : (totalSpent / totalPlanned) * 100}
			<div class="mb-6 glass-subtle rounded-2xl p-4">
				<div class="flex items-center justify-between mb-3">
					<span class="text-[13px] font-semibold text-text-primary">Budget global</span>
					<span class="text-[13px] font-bold tabular-nums {overallPct > 100 ? 'text-expense' : overallPct > 80 ? 'text-warning' : 'text-income'}">
						{Math.round(overallPct)}% utilisé
					</span>
				</div>
				<div class="h-2 w-full rounded-full bg-bg-elevated overflow-hidden">
					<div
						class="h-full rounded-full progress-bar {overallPct > 100 ? 'bg-danger' : overallPct > 80 ? 'bg-warning' : 'bg-income'}"
						style="width: {Math.min(overallPct, 100)}%"
					></div>
				</div>
				<div class="mt-2 flex justify-between text-[11px] text-text-muted tabular-nums">
					<span>Dépensé: {confidentialStore.format(totalSpent * -1)}</span>
					<span>Budget: {confidentialStore.format(totalPlanned * -1)}</span>
				</div>
			</div>
			{/if}

			<!-- Individual budget gauges (top categories) -->
			<div class="space-y-4">
				{#each budgetStore.budgetLines.filter((l: BudgetLineItem) => l.planned_amount !== 0 && l.budget_area !== 'income').slice(0, 6) as line}
					<BudgetHealthGauge
						planned={line.planned_amount}
						actual={line.actual_amount}
						label={line.series_name}
					/>
				{/each}
			</div>
		</div>
	{/if}

	{/if}
</div>
