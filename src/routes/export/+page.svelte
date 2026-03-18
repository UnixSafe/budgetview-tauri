<script lang="ts">
	import { onMount } from 'svelte';
	import { Download, FileSpreadsheet, FileText } from 'lucide-svelte';
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

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary">Export</h1>
		<p class="mt-1 text-sm text-text-muted">Exportez vos données en CSV ou PDF</p>
	</div>

	<!-- Type selector -->
	<div class="grid grid-cols-2 gap-4">
		<button onclick={() => (exportType = 'transactions')}
			class="flex items-center gap-4 glass-card p-6 transition-smooth btn-press
				{exportType === 'transactions' ? 'border-accent bg-accent/5' : 'hover:bg-bg-hover/30'}">
			<div class="flex h-12 w-12 items-center justify-center rounded-2xl {exportType === 'transactions' ? 'bg-accent/15' : 'bg-bg-elevated'}">
				<FileSpreadsheet size={22} class={exportType === 'transactions' ? 'text-accent' : 'text-text-muted'} />
			</div>
			<div class="text-left">
				<p class="text-[15px] font-semibold text-text-primary">Transactions</p>
				<p class="text-[12px] text-text-muted">Exporter les transactions en CSV</p>
			</div>
		</button>
		<button onclick={() => (exportType = 'budget')}
			class="flex items-center gap-4 glass-card p-6 transition-smooth btn-press
				{exportType === 'budget' ? 'border-accent bg-accent/5' : 'hover:bg-bg-hover/30'}">
			<div class="flex h-12 w-12 items-center justify-center rounded-2xl {exportType === 'budget' ? 'bg-accent/15' : 'bg-bg-elevated'}">
				<FileText size={22} class={exportType === 'budget' ? 'text-accent' : 'text-text-muted'} />
			</div>
			<div class="text-left">
				<p class="text-[15px] font-semibold text-text-primary">Budget</p>
				<p class="text-[12px] text-text-muted">Résumé budget mensuel en CSV</p>
			</div>
		</button>
	</div>

	<!-- Filters -->
	<div class="glass-card p-6">
		{#if exportType === 'transactions'}
			<h3 class="mb-4 text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Filtres</h3>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div>
					<label for="exp-account" class="mb-1.5 block text-[13px] font-medium text-text-muted">Compte</label>
					<select id="exp-account" bind:value={accountId}
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring">
						<option value="">Tous les comptes</option>
						{#each accountStore.accounts as account}
							<option value={account.id}>{account.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="exp-from" class="mb-1.5 block text-[13px] font-medium text-text-muted">Date début</label>
					<input id="exp-from" type="date" bind:value={dateFrom}
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring" />
				</div>
				<div>
					<label for="exp-to" class="mb-1.5 block text-[13px] font-medium text-text-muted">Date fin</label>
					<input id="exp-to" type="date" bind:value={dateTo}
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring" />
				</div>
			</div>
		{:else}
			<h3 class="mb-4 text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Période</h3>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="exp-year" class="mb-1.5 block text-[13px] font-medium text-text-muted">Année</label>
					<input id="exp-year" type="number" bind:value={budgetYear} min="2000" max="2100"
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring" />
				</div>
				<div>
					<label for="exp-month" class="mb-1.5 block text-[13px] font-medium text-text-muted">Mois</label>
					<select id="exp-month" bind:value={budgetMonth}
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring">
						{#each Array.from({ length: 12 }, (_, i) => i + 1) as m}
							<option value={m}>{formatMonth(budgetYear, m)}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}
	</div>

	<!-- Actions -->
	<div class="flex gap-3">
		<button onclick={handleExportCSV} disabled={exporting}
			class="flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-[14px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20 disabled:opacity-40">
			<Download size={18} />
			{exporting ? 'Export...' : 'Exporter en CSV'}
		</button>
		<button onclick={handlePrint}
			class="flex items-center gap-2 rounded-xl border border-border px-6 py-3.5 text-[14px] font-medium text-text-secondary transition-smooth btn-press hover:bg-bg-hover hover:text-text-primary">
			<FileText size={18} />
			Imprimer / PDF
		</button>
	</div>
</div>
