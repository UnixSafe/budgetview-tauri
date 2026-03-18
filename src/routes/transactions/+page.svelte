<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Upload, Search, X, Pencil, Trash2, Tag, Scissors } from 'lucide-svelte';
	import { transactionStore } from '$lib/stores/transactions.svelte';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { formatCurrency, formatDate, toEuros } from '$lib/utils/format';
	import type { Transaction } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import SplitModal from '$lib/components/SplitModal.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';

	let showForm = $state(false);
	let editingId = $state<number | null>(null);
	let formAccountId = $state<number>(0);
	let formDate = $state(new Date().toISOString().slice(0, 10));
	let formLabel = $state('');
	let formAmount = $state(0);
	let formNote = $state('');
	let formSeriesId = $state<number | string>('');

	// Categorization popover
	let categorizingId = $state<number | null>(null);

	// Split modal
	let splittingTx = $state<Transaction | null>(null);

	// "Apply to similar" prompt
	let similarPrompt = $state<{ txId: number; seriesId: number; subSeriesId: number | null; count: number } | null>(null);

	onMount(async () => {
		await Promise.all([
			accountStore.load(),
			budgetStore.loadSeries(),
			transactionStore.load()
		]);
	});

	function openCreate() {
		editingId = null;
		formAccountId = accountStore.accounts[0]?.id ?? 0;
		formDate = new Date().toISOString().slice(0, 10);
		formLabel = '';
		formAmount = 0;
		formNote = '';
		formSeriesId = '';
		showForm = true;
	}

	function openEdit(tx: Transaction) {
		editingId = tx.id;
		formAccountId = tx.account_id;
		formDate = tx.date;
		formLabel = tx.label;
		formAmount = toEuros(tx.amount);
		formNote = tx.note ?? '';
		formSeriesId = tx.series_id ?? '';
		showForm = true;
	}

	async function handleSubmit() {
		if (!formLabel.trim() || !formAccountId) return;
		const seriesId = formSeriesId === '' ? null : Number(formSeriesId);
		if (editingId) {
			await transactionStore.update(editingId, {
				account_id: formAccountId,
				date: formDate,
				label: formLabel,
				amount: formAmount,
				note: formNote || null,
				series_id: seriesId
			});
			toastStore.success('Transaction modifiée');
		} else {
			await transactionStore.create({
				account_id: formAccountId,
				date: formDate,
				label: formLabel,
				amount: formAmount,
				note: formNote || undefined,
				series_id: seriesId
			});
			toastStore.success('Transaction créée');
		}
		showForm = false;
	}

	async function handleCategorize(txId: number, seriesId: number | null) {
		const similarCount = await transactionStore.categorize(txId, seriesId);
		categorizingId = null;

		if (seriesId !== null && similarCount > 0) {
			similarPrompt = { txId, seriesId, subSeriesId: null, count: similarCount };
		}
	}

	async function handleApplyToSimilar() {
		if (!similarPrompt) return;
		const count = await transactionStore.applyToSimilar(similarPrompt.txId, similarPrompt.seriesId, similarPrompt.subSeriesId);
		toastStore.success(`${count} transaction${count > 1 ? 's' : ''} catégorisée${count > 1 ? 's' : ''}`);
		similarPrompt = null;
	}

	function dismissSimilarPrompt() {
		similarPrompt = null;
	}

	function handleSearch() {
		transactionStore.load();
	}

	function clearFilters() {
		transactionStore.search = '';
		transactionStore.filterAccountId = '';
		transactionStore.filterSeriesId = '';
		transactionStore.load();
	}

</script>

<svelte:head>
	<title>Transactions — BudgetView</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-text-primary">Transactions</h1>
		<div class="flex gap-2">
			<a
				href="/import"
				class="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
			>
				<Upload size={16} />
				Importer
			</a>
			<button
				onclick={openCreate}
				class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
			>
				<Plus size={16} />
				Ajouter
			</button>
		</div>
	</div>

	{#if transactionStore.error}
		<ErrorBanner message={transactionStore.error} ondismiss={() => (transactionStore.error = null)} />
	{/if}

	{#if similarPrompt}
		<div class="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 p-4">
			<p class="text-sm text-text-primary">
				<strong>{similarPrompt.count}</strong> autre{similarPrompt.count > 1 ? 's' : ''} transaction{similarPrompt.count > 1 ? 's' : ''} similaire{similarPrompt.count > 1 ? 's' : ''} non catégorisée{similarPrompt.count > 1 ? 's' : ''}.
				Appliquer la même catégorie ?
			</p>
			<div class="flex gap-2">
				<button
					onclick={handleApplyToSimilar}
					class="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
				>
					Appliquer
				</button>
				<button
					onclick={dismissSimilarPrompt}
					class="rounded-lg border border-border px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary"
				>
					Non merci
				</button>
			</div>
		</div>
	{/if}

	{#if transactionStore.loading}
		<LoadingSpinner message="Chargement des transactions..." />
	{:else}

	<!-- Filtres -->
	<div class="flex flex-wrap items-center gap-3">
		<div class="relative flex-1">
			<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
			<input
				bind:value={transactionStore.search}
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
				placeholder="Rechercher..."
				class="w-full rounded-lg border border-border bg-bg-card py-2 pl-9 pr-3 text-sm text-text-primary outline-none focus:border-accent"
			/>
		</div>
		<select
			bind:value={transactionStore.filterAccountId}
			onchange={handleSearch}
			class="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
		>
			<option value="">Tous les comptes</option>
			{#each accountStore.accounts as account}
				<option value={account.id}>{account.name}</option>
			{/each}
		</select>
		<select
			bind:value={transactionStore.filterSeriesId}
			onchange={handleSearch}
			class="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
		>
			<option value="">Toutes les catégories</option>
			{#each budgetStore.series as series}
				<option value={series.id}>{series.name}</option>
			{/each}
		</select>
		{#if transactionStore.search || transactionStore.filterAccountId || transactionStore.filterSeriesId}
			<button onclick={clearFilters} class="text-sm text-text-muted hover:text-text-primary">
				Effacer les filtres
			</button>
		{/if}
	</div>

	<!-- Liste -->
	{#if transactionStore.transactions.length === 0 && !transactionStore.loading}
		<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-12">
			<Upload size={48} class="mb-4 text-text-muted" />
			<p class="text-lg font-medium text-text-secondary">Aucune transaction</p>
			<p class="text-sm text-text-muted">Ajoutez une transaction ou importez un fichier bancaire</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-xl border border-border">
			<table class="w-full">
				<thead>
					<tr class="border-b border-border bg-bg-secondary text-left text-sm text-text-secondary">
						<th class="px-4 py-3 font-medium">Date</th>
						<th class="px-4 py-3 font-medium">Libellé</th>
						<th class="px-4 py-3 font-medium">Compte</th>
						<th class="px-4 py-3 font-medium">Catégorie</th>
						<th class="px-4 py-3 text-right font-medium">Montant</th>
						<th class="px-4 py-3 w-20"></th>
					</tr>
				</thead>
				<tbody>
					{#each transactionStore.transactions as tx (tx.id)}
						<tr class="border-b border-border transition-colors hover:bg-bg-hover">
							<td class="px-4 py-3 text-sm text-text-secondary">{formatDate(tx.date)}</td>
							<td class="px-4 py-3">
								<p class="text-sm font-medium text-text-primary">{tx.label}</p>
								{#if tx.note}
									<p class="text-xs text-text-muted">{tx.note}</p>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-text-secondary">{tx.account_name ?? ''}</td>
							<td class="px-4 py-3">
								<div class="relative">
									<button
										onclick={() => (categorizingId = categorizingId === tx.id ? null : tx.id)}
										class="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors
											{tx.series_name
											? 'bg-accent/10 text-accent'
											: 'bg-bg-hover text-text-muted hover:text-text-primary'}"
									>
										<Tag size={12} />
										{tx.series_name ?? 'Non catégorisée'}
										{#if tx.is_auto_categorized}
											<span class="ml-1 rounded bg-accent/20 px-1 py-0.5 text-[10px] font-semibold text-accent">Auto</span>
										{/if}
									</button>
									{#if categorizingId === tx.id}
										<div class="absolute left-0 top-full z-10 mt-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-border bg-bg-secondary shadow-xl">
											<button
												onclick={() => handleCategorize(tx.id, null)}
												class="w-full px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-hover"
											>
												Aucune catégorie
											</button>
											{#each budgetStore.series as series}
												<button
													onclick={() => handleCategorize(tx.id, series.id)}
													class="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-hover"
												>
													{series.name}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							</td>
							<td class="px-4 py-3 text-right text-sm font-medium {tx.amount >= 0 ? 'text-income' : 'text-expense'}">
								{formatCurrency(tx.amount)}
							</td>
							<td class="px-4 py-3">
								<div class="flex gap-1">
									<button onclick={() => (splittingTx = tx)} class="rounded p-1 text-text-muted hover:text-accent" title="Ventiler" aria-label="Ventiler la transaction {tx.label}">
										<Scissors size={14} />
									</button>
									<button onclick={() => openEdit(tx)} class="rounded p-1 text-text-muted hover:text-text-primary">
										<Pencil size={14} />
									</button>
									<button onclick={() => { if (confirm('Supprimer cette transaction ?')) transactionStore.remove(tx.id); }} class="rounded p-1 text-text-muted hover:text-danger">
										<Trash2 size={14} />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{/if}
</div>

<!-- Modal ajout/édition -->
{#if showForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={() => (showForm = false)}></div>
		<div class="relative w-full max-w-md rounded-xl border border-border bg-bg-secondary p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-text-primary">
					{editingId ? 'Modifier la transaction' : 'Nouvelle transaction'}
				</h2>
				<button onclick={() => (showForm = false)} class="text-text-muted hover:text-text-primary">
					<X size={20} />
				</button>
			</div>

			<form onsubmit={handleSubmit} class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="tx-date" class="mb-1 block text-sm font-medium text-text-secondary">Date *</label>
						<input
							id="tx-date"
							type="date"
							bind:value={formDate}
							required
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						/>
					</div>
					<div>
						<label for="tx-amount" class="mb-1 block text-sm font-medium text-text-secondary">Montant *</label>
						<input
							id="tx-amount"
							type="number"
							step="0.01"
							bind:value={formAmount}
							required
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						/>
					</div>
				</div>

				<div>
					<label for="tx-label" class="mb-1 block text-sm font-medium text-text-secondary">Libellé *</label>
					<input
						id="tx-label"
						bind:value={formLabel}
						required
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						placeholder="Courses Carrefour"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="tx-account" class="mb-1 block text-sm font-medium text-text-secondary">Compte *</label>
						<select
							id="tx-account"
							bind:value={formAccountId}
							required
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						>
							{#each accountStore.accounts as account}
								<option value={account.id}>{account.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="tx-series" class="mb-1 block text-sm font-medium text-text-secondary">Catégorie</label>
						<select
							id="tx-series"
							bind:value={formSeriesId}
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						>
							<option value="">Aucune</option>
							{#each budgetStore.series as series}
								<option value={series.id}>{series.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<div>
					<label for="tx-note" class="mb-1 block text-sm font-medium text-text-secondary">Note</label>
					<input
						id="tx-note"
						bind:value={formNote}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						placeholder="Note optionnelle"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<button type="button" onclick={() => (showForm = false)} class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
						Annuler
					</button>
					<button type="submit" class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
						{editingId ? 'Enregistrer' : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if splittingTx}
	<SplitModal
		transaction={splittingTx}
		onclose={() => { splittingTx = null; transactionStore.load(); }}
	/>
{/if}
