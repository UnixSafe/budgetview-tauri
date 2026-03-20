<script lang="ts">
	import { onMount } from 'svelte';
	import { Download, FileSpreadsheet, FileText, Check, Printer, ArrowRight } from 'lucide-svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { save } from '@tauri-apps/plugin-dialog';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { formatMonth } from '$lib/utils/format';

	let exportType = $state<'transactions' | 'budget'>('transactions');
	let accountId = $state<number | string>('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let budgetYear = $state(new Date().getFullYear());
	let budgetMonth = $state(new Date().getMonth() + 1);
	let exporting = $state(false);

	onMount(() => { accountStore.load(); });

	async function handleExportCSV() {
		let defaultName = exportType === 'transactions'
			? `transactions_${dateFrom || 'all'}_${dateTo || 'all'}.csv`
			: `budget_${budgetYear}_${String(budgetMonth).padStart(2, '0')}.csv`;

		const path = await save({ defaultPath: defaultName, filters: [{ name: 'CSV', extensions: ['csv'] }] });
		if (!path) return;

		exporting = true;
		try {
			let count: number;
			if (exportType === 'transactions') {
				count = await invoke<number>('export_transactions_csv', {
					filePath: path,
					accountId: accountId === '' ? null : Number(accountId),
					dateFrom: dateFrom || null, dateTo: dateTo || null
				});
			} else {
				count = await invoke<number>('export_budget_csv', {
					filePath: path, year: budgetYear, month: budgetMonth
				});
			}
			toastStore.success(`${count} ligne(s) exportée(s)`);
		} catch (e) {
			toastStore.error(String(e));
		} finally { exporting = false; }
	}

	function handlePrint() { window.print(); }
</script>

<svelte:head>
	<title>Export — BudgetView</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-10 animate-fade-in">
	<!-- Header -->
	<div class="text-center pt-4">
		<h1 class="text-headline text-text-primary">Export</h1>
		<p class="mt-2 text-body text-text-muted">Exportez vos données en CSV ou imprimez en PDF</p>
	</div>

	<!-- Type selector — segmented cards -->
	<div class="grid grid-cols-2 gap-4 stagger-children">
		<button onclick={() => (exportType = 'transactions')}
			class="relative glass-card p-7 text-left transition-smooth btn-press card-hover
				{exportType === 'transactions' ? 'border-accent/50 ring-1 ring-accent/20' : ''}">
			{#if exportType === 'transactions'}
				<div class="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-accent">
					<Check size={14} class="text-white" strokeWidth={3} />
				</div>
			{/if}
			<div class="flex h-14 w-14 items-center justify-center rounded-2xl mb-5
				{exportType === 'transactions' ? 'bg-accent/15' : 'bg-bg-elevated'}">
				<FileSpreadsheet size={26} class={exportType === 'transactions' ? 'text-accent' : 'text-text-muted'} strokeWidth={1.5} />
			</div>
			<p class="text-title text-text-primary mb-1">Transactions</p>
			<p class="text-caption text-text-muted">Exporter la liste des transactions au format CSV</p>
		</button>

		<button onclick={() => (exportType = 'budget')}
			class="relative glass-card p-7 text-left transition-smooth btn-press card-hover
				{exportType === 'budget' ? 'border-accent/50 ring-1 ring-accent/20' : ''}">
			{#if exportType === 'budget'}
				<div class="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-accent">
					<Check size={14} class="text-white" strokeWidth={3} />
				</div>
			{/if}
			<div class="flex h-14 w-14 items-center justify-center rounded-2xl mb-5
				{exportType === 'budget' ? 'bg-accent/15' : 'bg-bg-elevated'}">
				<FileText size={26} class={exportType === 'budget' ? 'text-accent' : 'text-text-muted'} strokeWidth={1.5} />
			</div>
			<p class="text-title text-text-primary mb-1">Budget</p>
			<p class="text-caption text-text-muted">Résumé du budget mensuel au format CSV</p>
		</button>
	</div>

	<!-- Filters -->
	<div class="glass-card p-7 animate-slide-up">
		{#if exportType === 'transactions'}
			<h3 class="text-caption text-text-secondary uppercase tracking-wider mb-5">Filtres de l'export</h3>
			<div class="space-y-5">
				<div>
					<label for="exp-account" class="mb-2 block text-[13px] font-medium text-text-muted">Compte</label>
					<select id="exp-account" bind:value={accountId}
						class="w-full rounded-2xl border border-border bg-bg-input px-5 py-3.5 text-[14px] text-text-primary outline-none focus-ring">
						<option value="">Tous les comptes</option>
						{#each accountStore.accounts as account}
							<option value={account.id}>{account.name}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="exp-from" class="mb-2 block text-[13px] font-medium text-text-muted">Date début</label>
						<input id="exp-from" type="date" bind:value={dateFrom}
							class="w-full rounded-2xl border border-border bg-bg-input px-5 py-3.5 text-[14px] text-text-primary outline-none focus-ring" />
					</div>
					<div>
						<label for="exp-to" class="mb-2 block text-[13px] font-medium text-text-muted">Date de fin</label>
						<input id="exp-to" type="date" bind:value={dateTo}
							class="w-full rounded-2xl border border-border bg-bg-input px-5 py-3.5 text-[14px] text-text-primary outline-none focus-ring" />
					</div>
				</div>
			</div>
		{:else}
			<h3 class="text-caption text-text-secondary uppercase tracking-wider mb-5">Période du budget</h3>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="exp-year" class="mb-2 block text-[13px] font-medium text-text-muted">Année</label>
					<input id="exp-year" type="number" bind:value={budgetYear} min="2000" max="2100"
						class="w-full rounded-2xl border border-border bg-bg-input px-5 py-3.5 text-[14px] text-text-primary outline-none focus-ring" />
				</div>
				<div>
					<label for="exp-month" class="mb-2 block text-[13px] font-medium text-text-muted">Mois</label>
					<select id="exp-month" bind:value={budgetMonth}
						class="w-full rounded-2xl border border-border bg-bg-input px-5 py-3.5 text-[14px] text-text-primary outline-none focus-ring">
						{#each Array.from({ length: 12 }, (_, i) => i + 1) as m}
							<option value={m}>{formatMonth(budgetYear, m)}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}
	</div>

	<!-- Actions -->
	<div class="flex flex-col gap-3 sm:flex-row animate-slide-up" style="animation-delay: 60ms;">
		<button onclick={handleExportCSV} disabled={exporting}
			class="btn-primary flex-1 justify-center py-4 text-[15px] rounded-2xl disabled:opacity-40 disabled:pointer-events-none">
			{#if exporting}
				<div class="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
				Export en cours...
			{:else}
				<Download size={18} strokeWidth={2} />
				Exporter en CSV
				<ArrowRight size={16} class="ml-1 opacity-60" />
			{/if}
		</button>
		<button onclick={handlePrint} class="btn-secondary justify-center py-4 rounded-2xl">
			<Printer size={18} strokeWidth={2} />
			Imprimer / PDF
		</button>
	</div>
</div>
