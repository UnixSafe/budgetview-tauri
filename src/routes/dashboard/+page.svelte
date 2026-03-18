<script lang="ts">
	import { onMount } from 'svelte';
	import { Wallet, TrendingUp, TrendingDown, ArrowLeftRight, Landmark, Tag, ChevronRight } from 'lucide-svelte';
	import { formatCurrency, ACCOUNT_TYPE_LABELS } from '$lib/utils/format';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { query } from '$lib/stores/db';
	import type { DashboardSummary, BudgetLineItem } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import OnboardingGuide from '$lib/components/OnboardingGuide.svelte';

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

	let currentMonthLabel = $derived(
		new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date())
	);

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
		} catch (e) {
			error = e instanceof Error ? e.message : 'Erreur inconnue';
		} finally {
			loading = false;
		}
	});

	function formatDateShort(dateStr: string) {
		const d = new Date(dateStr);
		return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
	}
</script>

<svelte:head>
	<title>Tableau de bord — BudgetView</title>
</svelte:head>

<div class="space-y-8">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary">Bonjour</h1>
		<p class="mt-1 text-base text-text-muted capitalize">{currentMonthLabel}</p>
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
			<p class="mt-1 text-2xl font-bold tracking-tight text-text-primary">{formatCurrency(summary.total_balance)}</p>
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-income/12">
				<TrendingUp size={20} class="text-income" strokeWidth={1.8} />
			</div>
			<p class="text-[12px] font-medium text-text-muted uppercase tracking-wide">Revenus</p>
			<p class="mt-1 text-2xl font-bold tracking-tight text-income">{formatCurrency(summary.month_income)}</p>
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-expense/12">
				<TrendingDown size={20} class="text-expense" strokeWidth={1.8} />
			</div>
			<p class="text-[12px] font-medium text-text-muted uppercase tracking-wide">Dépenses</p>
			<p class="mt-1 text-2xl font-bold tracking-tight text-expense">{formatCurrency(summary.month_expenses)}</p>
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-purple/12">
				<ArrowLeftRight size={20} class="text-purple" strokeWidth={1.8} />
			</div>
			<p class="text-[12px] font-medium text-text-muted uppercase tracking-wide">Transactions</p>
			<p class="mt-1 text-2xl font-bold tracking-tight text-text-primary">{summary.transaction_count}</p>
		</div>
	</div>

	<!-- Uncategorized alert -->
	{#if uncategorizedCount > 0}
		<a href="/transactions" class="group flex items-center gap-4 rounded-2xl border border-warning/15 bg-warning/5 p-5 transition-smooth hover:bg-warning/8 animate-slide-up btn-press">
			<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/12">
				<Tag size={20} class="text-warning" strokeWidth={1.8} />
			</div>
			<div class="flex-1">
				<p class="text-[14px] font-semibold text-warning">{uncategorizedCount} transaction{uncategorizedCount > 1 ? 's' : ''} non catégorisée{uncategorizedCount > 1 ? 's' : ''}</p>
				<p class="text-[12px] text-text-muted">Catégorisez vos transactions pour un suivi précis</p>
			</div>
			<ChevronRight size={18} class="text-text-muted group-hover:text-warning transition-smooth" />
		</a>
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
								{formatCurrency(account.computed_balance)}
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
								{formatCurrency(tx.amount)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Budget summary -->
	{#if budgetStore.budgetLines.length > 0}
		<div class="glass-card p-6">
			<div class="mb-5 flex items-center justify-between">
				<h2 class="text-lg font-semibold tracking-tight text-text-primary">Budget du mois</h2>
				<a href="/budget" class="text-[12px] font-medium text-accent hover:text-accent-hover transition-smooth">Détails</a>
			</div>
			<div class="space-y-4">
				{#each budgetStore.budgetLines.filter((l: BudgetLineItem) => l.planned_amount !== 0).slice(0, 8) as line}
					{@const pct = line.planned_amount === 0 ? 0 : Math.min(Math.abs(line.actual_amount) / Math.abs(line.planned_amount) * 100, 100)}
					{@const over = line.budget_area !== 'income' && Math.abs(line.actual_amount) > Math.abs(line.planned_amount)}
					<div>
						<div class="flex items-center justify-between text-[13px] mb-2">
							<span class="font-medium text-text-primary">{line.series_name}</span>
							<span class="tabular-nums {over ? 'text-expense font-semibold' : 'text-text-secondary'}">
								{formatCurrency(line.actual_amount)} / {formatCurrency(line.planned_amount)}
							</span>
						</div>
						<div class="h-[6px] w-full rounded-full bg-bg-elevated overflow-hidden">
							<div
								class="h-full rounded-full progress-bar {over ? 'bg-danger' : line.budget_area === 'income' ? 'bg-income' : 'bg-accent'}"
								style="width: {pct}%"
							></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{/if}
</div>
