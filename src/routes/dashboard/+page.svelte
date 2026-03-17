<script lang="ts">
	import { onMount } from 'svelte';
	import { Wallet, TrendingUp, TrendingDown, ArrowLeftRight, Landmark } from 'lucide-svelte';
	import { formatCurrency, ACCOUNT_TYPE_LABELS, BUDGET_AREA_LABELS } from '$lib/utils/format';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { query } from '$lib/stores/db';
	import type { DashboardSummary, BudgetLineItem } from '$lib/types';

	let summary = $state<DashboardSummary>({
		total_balance: 0,
		month_income: 0,
		month_expenses: 0,
		transaction_count: 0
	});

	let recentTransactions = $state<{ date: string; label: string; amount: number; account_name: string }[]>([]);

	onMount(async () => {
		await accountStore.load();
		await budgetStore.loadBudgetView();

		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth() + 1;
		const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
		const endMonth = month === 12 ? 1 : month + 1;
		const endYear = month === 12 ? year + 1 : year;
		const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

		const [incomeResult, expenseResult, countResult, recent] = await Promise.all([
			query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date >= $1 AND date < $2 AND amount > 0', [startDate, endDate]),
			query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date >= $1 AND date < $2 AND amount < 0', [startDate, endDate]),
			query<{ count: number }>('SELECT COUNT(*) as count FROM transactions WHERE date >= $1 AND date < $2', [startDate, endDate]),
			query<{ date: string; label: string; amount: number; account_name: string }>(
				`SELECT t.date, t.label, t.amount, a.name as account_name
				 FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id
				 ORDER BY t.date DESC, t.id DESC LIMIT 10`
			)
		]);

		summary = {
			total_balance: accountStore.totalBalance,
			month_income: incomeResult[0]?.total ?? 0,
			month_expenses: expenseResult[0]?.total ?? 0,
			transaction_count: countResult[0]?.count ?? 0
		};

		recentTransactions = recent;
	});
</script>

<svelte:head>
	<title>Tableau de bord — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-text-primary">Tableau de bord</h1>

	<!-- Cartes résumé -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-xl border border-border bg-bg-card p-5">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-accent/10 p-2">
					<Wallet size={20} class="text-accent" />
				</div>
				<div>
					<p class="text-sm text-text-secondary">Solde total</p>
					<p class="text-xl font-bold text-text-primary">{formatCurrency(summary.total_balance)}</p>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-border bg-bg-card p-5">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-income/10 p-2">
					<TrendingUp size={20} class="text-income" />
				</div>
				<div>
					<p class="text-sm text-text-secondary">Revenus du mois</p>
					<p class="text-xl font-bold text-income">{formatCurrency(summary.month_income)}</p>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-border bg-bg-card p-5">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-expense/10 p-2">
					<TrendingDown size={20} class="text-expense" />
				</div>
				<div>
					<p class="text-sm text-text-secondary">Dépenses du mois</p>
					<p class="text-xl font-bold text-expense">{formatCurrency(summary.month_expenses)}</p>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-border bg-bg-card p-5">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-accent/10 p-2">
					<ArrowLeftRight size={20} class="text-accent" />
				</div>
				<div>
					<p class="text-sm text-text-secondary">Transactions</p>
					<p class="text-xl font-bold text-text-primary">{summary.transaction_count}</p>
				</div>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Comptes -->
		<div class="rounded-xl border border-border bg-bg-card p-5">
			<h2 class="mb-4 text-lg font-semibold text-text-primary">Comptes</h2>
			{#if accountStore.accounts.length === 0}
				<p class="text-sm text-text-muted">Aucun compte configuré</p>
			{:else}
				<div class="space-y-3">
					{#each accountStore.accounts as account}
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<Landmark size={16} class="text-text-muted" />
								<div>
									<p class="text-sm font-medium text-text-primary">{account.name}</p>
									<p class="text-xs text-text-muted">{ACCOUNT_TYPE_LABELS[account.account_type]}</p>
								</div>
							</div>
							<span class="text-sm font-semibold {account.initial_balance >= 0 ? 'text-income' : 'text-expense'}">
								{formatCurrency(account.initial_balance)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Dernières transactions -->
		<div class="rounded-xl border border-border bg-bg-card p-5">
			<h2 class="mb-4 text-lg font-semibold text-text-primary">Dernières transactions</h2>
			{#if recentTransactions.length === 0}
				<p class="text-sm text-text-muted">Aucune transaction</p>
			{:else}
				<div class="space-y-2">
					{#each recentTransactions as tx}
						<div class="flex items-center justify-between text-sm">
							<div>
								<p class="font-medium text-text-primary">{tx.label}</p>
								<p class="text-xs text-text-muted">{tx.account_name}</p>
							</div>
							<span class="font-medium {tx.amount >= 0 ? 'text-income' : 'text-expense'}">
								{formatCurrency(tx.amount)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Budget du mois -->
	{#if budgetStore.budgetLines.length > 0}
		<div class="rounded-xl border border-border bg-bg-card p-5">
			<h2 class="mb-4 text-lg font-semibold text-text-primary">Budget du mois</h2>
			<div class="space-y-3">
				{#each budgetStore.budgetLines.filter((l: BudgetLineItem) => l.planned_amount !== 0) as line}
					{@const pct = line.planned_amount === 0 ? 0 : Math.min(Math.abs(line.actual_amount) / Math.abs(line.planned_amount) * 100, 100)}
					{@const over = line.budget_area !== 'income' && Math.abs(line.actual_amount) > Math.abs(line.planned_amount)}
					<div>
						<div class="flex items-center justify-between text-sm mb-1">
							<span class="text-text-primary">{line.series_name}</span>
							<span class="{over ? 'text-expense' : 'text-text-secondary'}">
								{formatCurrency(line.actual_amount)} / {formatCurrency(line.planned_amount)}
							</span>
						</div>
						<div class="h-1.5 w-full rounded-full bg-bg-hover">
							<div
								class="h-1.5 rounded-full {over ? 'bg-danger' : 'bg-accent'}"
								style="width: {pct}%"
							></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
