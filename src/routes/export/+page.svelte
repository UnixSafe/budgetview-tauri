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

	onMount(() => {
		accountStore.load();
	});

	async function handleExportCSV() {
		let defaultName: string;
		if (exportType === 'transactions') {
			defaultName = `transactions_${dateFrom || 'all'}_${dateTo || 'all'}.csv`;
		} else {
			defaultName = `budget_${budgetYear}_${String(budgetMonth).padStart(2, '0')}.csv`;
		}

		const path = await save({
			defaultPath: defaultName,
			filters: [{ name: 'CSV', extensions: ['csv'] }]
		});

		if (!path) return;

		exporting = true;
		try {
			let count: number;
			if (exportType === 'transactions') {
				count = await invoke<number>('export_transactions_csv', {
					filePath: path,
					accountId: accountId === '' ? null : Number(accountId),
					dateFrom: dateFrom || null,
					dateTo: dateTo || null
				});
			} else {
				count = await invoke<number>('export_budget_csv', {
					filePath: path,
					year: budgetYear,
					month: budgetMonth
				});
			}
			toastStore.success(`${count} ligne(s) exportée(s)`);
		} catch (e) {
			toastStore.error(String(e));
		} finally {
			exporting = false;
		}
	}

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Export — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-text-primary">Export</h1>

	<!-- Export type selector -->
	<div class="flex gap-4">
		<button
			onclick={() => (exportType = 'transactions')}
			class="flex flex-1 items-center gap-3 rounded-xl border p-4 transition-colors
				{exportType === 'transactions' ? 'border-accent bg-accent/5' : 'border-border bg-bg-card hover:bg-bg-hover'}"
		>
			<FileSpreadsheet size={24} class={exportType === 'transactions' ? 'text-accent' : 'text-text-muted'} />
			<div class="text-left">
				<p class="text-sm font-semibold text-text-primary">Transactions</p>
				<p class="text-xs text-text-muted">Exporter les transactions en CSV</p>
			</div>
		</button>
		<button
			onclick={() => (exportType = 'budget')}
			class="flex flex-1 items-center gap-3 rounded-xl border p-4 transition-colors
				{exportType === 'budget' ? 'border-accent bg-accent/5' : 'border-border bg-bg-card hover:bg-bg-hover'}"
		>
			<FileText size={24} class={exportType === 'budget' ? 'text-accent' : 'text-text-muted'} />
			<div class="text-left">
				<p class="text-sm font-semibold text-text-primary">Budget</p>
				<p class="text-xs text-text-muted">Exporter le résumé budget en CSV</p>
			</div>
		</button>
	</div>

	<!-- Filters -->
	<div class="rounded-xl border border-border bg-bg-card p-4">
		{#if exportType === 'transactions'}
			<h3 class="mb-3 text-sm font-semibold text-text-secondary">Filtres transactions</h3>
			<div class="grid grid-cols-3 gap-4">
				<div>
					<label for="exp-account" class="mb-1 block text-xs text-text-muted">Compte</label>
					<select
						id="exp-account"
						bind:value={accountId}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
					>
						<option value="">Tous les comptes</option>
						{#each accountStore.accounts as account}
							<option value={account.id}>{account.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="exp-from" class="mb-1 block text-xs text-text-muted">Date début</label>
					<input
						id="exp-from"
						type="date"
						bind:value={dateFrom}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
					/>
				</div>
				<div>
					<label for="exp-to" class="mb-1 block text-xs text-text-muted">Date fin</label>
					<input
						id="exp-to"
						type="date"
						bind:value={dateTo}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
					/>
				</div>
			</div>
		{:else}
			<h3 class="mb-3 text-sm font-semibold text-text-secondary">Période budget</h3>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="exp-year" class="mb-1 block text-xs text-text-muted">Année</label>
					<input
						id="exp-year"
						type="number"
						bind:value={budgetYear}
						min="2000"
						max="2100"
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
					/>
				</div>
				<div>
					<label for="exp-month" class="mb-1 block text-xs text-text-muted">Mois</label>
					<select
						id="exp-month"
						bind:value={budgetMonth}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
					>
						{#each Array.from({ length: 12 }, (_, i) => i + 1) as m}
							<option value={m}>{formatMonth(budgetYear, m)}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}
	</div>

	<!-- Export buttons -->
	<div class="flex gap-3">
		<button
			onclick={handleExportCSV}
			disabled={exporting}
			class="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
		>
			<Download size={16} />
			{exporting ? 'Export en cours...' : 'Exporter en CSV'}
		</button>
		<button
			onclick={handlePrint}
			class="flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
		>
			<FileText size={16} />
			Imprimer / PDF
		</button>
	</div>
</div>
