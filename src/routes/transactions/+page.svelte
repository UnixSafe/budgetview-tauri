<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Plus, Upload, Search, X, Pencil, Trash2, Tag, Scissors, Calendar, CheckCircle2, Circle, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-svelte';
	import { transactionStore } from '$lib/stores/transactions.svelte';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { splitStore } from '$lib/stores/splits.svelte';
	import { formatCurrency, formatDate, toEuros } from '$lib/utils/format';
	import { confidentialStore } from '$lib/stores/confidential.svelte';
	import type { Transaction } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import SplitModal from '$lib/components/SplitModal.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { query } from '$lib/stores/db';

	let showForm = $state(false);
	let editingId = $state<number | null>(null);
	let formAccountId = $state<number>(0);
	let formDate = $state(new Date().toISOString().slice(0, 10));
	let formLabel = $state('');
	let formAmount = $state(0);
	let formNote = $state('');
	let formSeriesId = $state<number | string>('');

	// Quick entry panel
	let showQuickEntry = $state(false);
	let quickLabel = $state('');
	let quickAmount = $state(0);
	let quickAccountId = $state<number>(0);
	let quickDate = $state(new Date().toISOString().slice(0, 10));
	let quickSeriesId = $state<number | string>('');

	async function handleQuickSubmit() {
		if (!quickLabel.trim() || !quickAccountId) return;
		await transactionStore.create({
			account_id: quickAccountId,
			date: quickDate,
			label: quickLabel,
			amount: quickAmount,
			series_id: quickSeriesId === '' ? undefined : Number(quickSeriesId)
		});
		toastStore.success('Transaction créée');
		quickLabel = '';
		quickAmount = 0;
		quickDate = new Date().toISOString().slice(0, 10);
		quickSeriesId = '';
		// Keep quick entry open for rapid entry
	}

	let categorizingId = $state<number | null>(null);
	let splittingTx = $state<Transaction | null>(null);
	let similarPrompt = $state<{ txId: number; seriesId: number; subSeriesId: number | null; count: number; seriesName: string } | null>(null);
	let similarTransactions = $state<Transaction[]>([]);
	let showSimilarList = $state(false);
	let similarExcluded = $state<Set<number>>(new Set());

	// Batch selection
	let selectedIds = $state<Set<number>>(new Set());
	let batchMode = $state(false);
	let showBatchCategorize = $state(false);

	function toggleSelect(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
		if (next.size === 0) batchMode = false;
	}

	function selectAll() {
		selectedIds = new Set(filteredTransactions.map(t => t.id));
	}

	function clearSelection() {
		selectedIds = new Set();
		batchMode = false;
		showBatchCategorize = false;
	}

	async function handleBatchCategorize(seriesId: number | null, subSeriesId: number | null = null) {
		const count = await transactionStore.batchCategorize([...selectedIds], seriesId, subSeriesId);
		toastStore.success(`${count} transaction${count > 1 ? 's' : ''} catégorisée${count > 1 ? 's' : ''}`);
		clearSelection();
	}

	// Autocomplete
	let suggestions = $state<string[]>([]);
	let showSuggestions = $state(false);
	let autocompleteTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleSearchInput() {
		if (autocompleteTimeout) clearTimeout(autocompleteTimeout);
		const val = transactionStore.search.trim();
		if (val.length < 2) { suggestions = []; showSuggestions = false; return; }
		autocompleteTimeout = setTimeout(async () => {
			const results = await query<{ label: string }>(
				`SELECT DISTINCT label FROM transactions WHERE label LIKE $1 ORDER BY label LIMIT 8`,
				[`%${val}%`]
			);
			suggestions = results.map(r => r.label);
			showSuggestions = suggestions.length > 0;
		}, 200);
	}

	function selectSuggestion(label: string) {
		transactionStore.search = label;
		showSuggestions = false;
		handleSearch();
	}

	onMount(async () => {
		// Apply URL query params as filters
		const params = page.url.searchParams;
		if (params.get('series')) transactionStore.filterSeriesId = params.get('series')!;
		if (params.get('from')) transactionStore.filterDateFrom = params.get('from')!;
		if (params.get('to')) transactionStore.filterDateTo = params.get('to')!;
		if (params.get('account')) transactionStore.filterAccountId = params.get('account')!;
		if (params.get('q')) transactionStore.search = params.get('q')!;

		hasExternalFilter = !!(params.get('series') || params.get('account'));

		await Promise.all([
			accountStore.load(),
			budgetStore.loadSeries(),
			transactionStore.load(),
			splitStore.loadBatchStatus()
		]);
		quickAccountId = accountStore.accounts[0]?.id ?? 0;

		// Resolve filter label for the banner
		if (params.get('series')) {
			const seriesId = Number(params.get('series'));
			const series = budgetStore.series.find(s => s.id === seriesId);
			externalFilterLabel = series?.name ?? `Catégorie #${seriesId}`;
		} else if (params.get('account')) {
			const accountId = Number(params.get('account'));
			const account = accountStore.accounts.find(a => a.id === accountId);
			externalFilterLabel = account?.name ?? `Compte #${accountId}`;
		}
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

	async function handleCategorize(txId: number, seriesId: number | null, subSeriesId: number | null = null) {
		const similarCount = await transactionStore.categorize(txId, seriesId, subSeriesId);
		categorizingId = null;

		if (seriesId !== null && similarCount > 0) {
			const seriesName = budgetStore.series.find(s => s.id === seriesId)?.name ?? '';
			similarPrompt = { txId, seriesId, subSeriesId, count: similarCount, seriesName };
			similarTransactions = [];
			showSimilarList = false;
			similarExcluded = new Set();
		}
	}

	async function loadSimilarTransactions() {
		if (!similarPrompt) return;
		const tx = transactionStore.transactions.find(t => t.id === similarPrompt!.txId);
		if (!tx) return;
		const { categorizationStore } = await import('$lib/stores/categorization.svelte');
		similarTransactions = await categorizationStore.findSimilarUncategorized(tx);
		showSimilarList = true;
		similarExcluded = new Set();
	}

	function toggleSimilarExclude(id: number) {
		const next = new Set(similarExcluded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		similarExcluded = next;
	}

	async function handleApplyToSimilar() {
		if (!similarPrompt) return;

		if (showSimilarList && similarExcluded.size > 0) {
			// Apply only to non-excluded similar transactions
			const toApply = similarTransactions.filter(t => !similarExcluded.has(t.id));
			let count = 0;
			for (const tx of toApply) {
				await query(
					'UPDATE transactions SET series_id = $1, sub_series_id = $2, is_auto_categorized = 0 WHERE id = $3',
					[similarPrompt.seriesId, similarPrompt.subSeriesId, tx.id]
				);
				count++;
			}
			toastStore.success(`${count} transaction${count > 1 ? 's' : ''} catégorisée${count > 1 ? 's' : ''}`);
		} else {
			const count = await transactionStore.applyToSimilar(similarPrompt.txId, similarPrompt.seriesId, similarPrompt.subSeriesId);
			toastStore.success(`${count} transaction${count > 1 ? 's' : ''} catégorisée${count > 1 ? 's' : ''}`);
		}

		similarPrompt = null;
		showSimilarList = false;
		similarTransactions = [];
		await transactionStore.load();
	}

	function dismissSimilarPrompt() {
		similarPrompt = null;
		showSimilarList = false;
		similarTransactions = [];
	}

	function handleSearch() {
		transactionStore.load();
	}

	function clearFilters() {
		transactionStore.search = '';
		transactionStore.filterAccountId = '';
		transactionStore.filterSeriesId = '';
		transactionStore.filterDateFrom = '';
		transactionStore.filterDateTo = '';
		transactionStore.filterAmountMin = '';
		transactionStore.filterAmountMax = '';
		transactionStore.filterCategorization = '';
		transactionStore.filterReconciled = '';
		transactionStore.load();
	}

	async function toggleReconciled(tx: Transaction) {
		const newValue = tx.is_reconciled ? 0 : 1;
		await transactionStore.update(tx.id, { is_reconciled: newValue });
		tx.is_reconciled = !!newValue;
		toastStore.success(newValue ? 'Transaction pointée' : 'Pointage annulé');
	}

	let hasExternalFilter = $state(false);
	let externalFilterLabel = $state('');

	let filteredTransactions = $derived(transactionStore.transactions);

	function formatDateShort(dateStr: string) {
		const d = new Date(dateStr);
		return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
	}
</script>

<svelte:head>
	<title>Transactions — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<!-- Back banner when coming from a filtered view -->
	{#if hasExternalFilter}
		<div class="flex items-center gap-3 glass-card-sm px-4 py-3 animate-slide-down">
			<button
				onclick={() => history.back()}
				class="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium text-accent transition-smooth btn-press hover:bg-accent/10"
			>
				<ArrowLeft size={16} strokeWidth={2} />
				Retour
			</button>
			<div class="h-4 w-px bg-border"></div>
			<p class="text-[13px] text-text-secondary">
				Filtre : <span class="font-semibold text-accent">{externalFilterLabel}</span>
			</p>
			<button
				onclick={() => { clearFilters(); hasExternalFilter = false; goto('/transactions'); }}
				class="ml-auto text-[12px] text-text-muted hover:text-text-primary transition-smooth"
			>
				Effacer le filtre
			</button>
		</div>
	{/if}

	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Transactions</h1>
			<p class="mt-1 text-sm text-text-muted">
			{filteredTransactions.length} opération{filteredTransactions.length > 1 ? 's' : ''}
			{#if transactionStore.totalCount > filteredTransactions.length}
				<span class="text-text-muted/50">sur {transactionStore.totalCount}</span>
			{/if}
		</p>
		</div>
		<div class="flex gap-2">
			<a
				href="/import"
				class="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13px] font-medium text-text-secondary transition-smooth btn-press hover:bg-bg-hover hover:text-text-primary"
			>
				<Upload size={15} />
				Importer
			</a>
			<button
				onclick={() => { showQuickEntry = !showQuickEntry; if (showQuickEntry) quickAccountId = accountStore.accounts[0]?.id ?? 0; }}
				class="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-smooth btn-press
					{showQuickEntry ? 'bg-accent/10 text-accent border border-accent/30' : 'border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary'}"
				title="Saisie rapide"
			>
				{#if showQuickEntry}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
				Rapide
			</button>
			<button
				onclick={openCreate}
				class="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20"
			>
				<Plus size={15} strokeWidth={2.5} />
				Ajouter
			</button>
		</div>
	</div>

	<!-- Quick entry panel -->
	{#if showQuickEntry}
		<div class="glass-card p-5 animate-slide-down">
			<form onsubmit={handleQuickSubmit} class="flex items-end gap-3 flex-wrap">
				<div class="flex-1 min-w-[150px]">
					<label for="quick-label" class="mb-1 block text-[11px] font-medium text-text-muted">Libellé</label>
					<input id="quick-label" bind:value={quickLabel} required placeholder="Courses, loyer..."
						class="w-full rounded-xl border border-border bg-bg-input px-3 py-2.5 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
				</div>
				<div class="w-28">
					<label for="quick-amount" class="mb-1 block text-[11px] font-medium text-text-muted">Montant</label>
					<input id="quick-amount" type="number" step="0.01" bind:value={quickAmount} required
						class="w-full rounded-xl border border-border bg-bg-input px-3 py-2.5 text-[13px] text-text-primary outline-none focus-ring" />
				</div>
				<div class="w-36">
					<label for="quick-date" class="mb-1 block text-[11px] font-medium text-text-muted">Date</label>
					<input id="quick-date" type="date" bind:value={quickDate}
						class="w-full rounded-xl border border-border bg-bg-input px-3 py-2.5 text-[13px] text-text-primary outline-none focus-ring" />
				</div>
				<div class="w-32">
					<label for="quick-account" class="mb-1 block text-[11px] font-medium text-text-muted">Compte</label>
					<select id="quick-account" bind:value={quickAccountId}
						class="w-full rounded-xl border border-border bg-bg-input px-3 py-2.5 text-[13px] text-text-primary outline-none focus-ring">
						{#each accountStore.accounts as account}
							<option value={account.id}>{account.name}</option>
						{/each}
					</select>
				</div>
				<div class="w-32">
					<label for="quick-series" class="mb-1 block text-[11px] font-medium text-text-muted">Catégorie</label>
					<select id="quick-series" bind:value={quickSeriesId}
						class="w-full rounded-xl border border-border bg-bg-input px-3 py-2.5 text-[13px] text-text-primary outline-none focus-ring">
						<option value="">—</option>
						{#each budgetStore.series as series}
							<option value={series.id}>{series.name}</option>
						{/each}
					</select>
				</div>
				<button type="submit"
					class="rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20">
					Ajouter
				</button>
			</form>
		</div>
	{/if}

	{#if transactionStore.error}
		<ErrorBanner message={transactionStore.error} ondismiss={() => (transactionStore.error = null)} />
	{/if}

	{#if similarPrompt}
		<div class="glass-card border-accent/20 animate-slide-up overflow-hidden">
			<div class="flex items-center justify-between p-5">
				<p class="text-[13px] text-text-primary">
					<strong class="text-accent">{similarPrompt.count}</strong> transaction{similarPrompt.count > 1 ? 's' : ''} similaire{similarPrompt.count > 1 ? 's' : ''} non catégorisée{similarPrompt.count > 1 ? 's' : ''}
					→ <span class="font-semibold text-accent">{similarPrompt.seriesName}</span>
				</p>
				<div class="flex gap-2">
					<button
						onclick={loadSimilarTransactions}
						class="rounded-xl border border-accent/30 bg-accent/5 px-4 py-2 text-[13px] font-medium text-accent transition-smooth btn-press hover:bg-accent/10"
					>
						{showSimilarList ? 'Masquer' : 'Vérifier'}
					</button>
					<button
						onclick={handleApplyToSimilar}
						class="rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover"
					>
						Appliquer{#if showSimilarList && similarExcluded.size > 0} ({similarTransactions.length - similarExcluded.size}){/if}
					</button>
					<button
						onclick={dismissSimilarPrompt}
						class="rounded-xl border border-border px-4 py-2 text-[13px] text-text-secondary transition-smooth hover:text-text-primary"
					>
						Ignorer
					</button>
				</div>
			</div>

			<!-- Similar transactions list -->
			{#if showSimilarList && similarTransactions.length > 0}
				<div class="border-t border-border-light/50 divide-y divide-border-light/30 max-h-64 overflow-y-auto">
					{#each similarTransactions as stx (stx.id)}
						{@const excluded = similarExcluded.has(stx.id)}
						<label class="flex items-center gap-3 px-5 py-3 cursor-pointer transition-smooth hover:bg-bg-hover/30 {excluded ? 'opacity-40' : ''}">
							<input
								type="checkbox"
								checked={!excluded}
								onchange={() => toggleSimilarExclude(stx.id)}
								class="accent-accent rounded"
							/>
							<div class="min-w-0 flex-1">
								<p class="text-[13px] font-medium text-text-primary truncate">{stx.label}</p>
								<p class="text-[11px] text-text-muted">
									{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(stx.date))}
									{#if stx.account_name} · {stx.account_name}{/if}
								</p>
							</div>
							<span class="text-[13px] font-semibold tabular-nums whitespace-nowrap {stx.amount >= 0 ? 'text-income' : 'text-expense'}">
								{confidentialStore.format(stx.amount)}
							</span>
						</label>
					{/each}
				</div>
				{#if similarExcluded.size > 0}
					<div class="px-5 py-2 bg-bg-primary/20 text-[11px] text-text-muted border-t border-border-light/30">
						{similarExcluded.size} exclue{similarExcluded.size > 1 ? 's' : ''} — {similarTransactions.length - similarExcluded.size} sera/seront catégorisée{similarTransactions.length - similarExcluded.size > 1 ? 's' : ''}
					</div>
				{/if}
			{:else if showSimilarList}
				<div class="px-5 py-4 border-t border-border-light/50 text-[13px] text-text-muted text-center">
					Chargement...
				</div>
			{/if}
		</div>
	{/if}

	<!-- Batch action bar -->
	{#if selectedIds.size > 0}
		<div class="glass-card-sm flex items-center justify-between px-5 py-3.5 border-l-[3px] border-l-accent animate-slide-down">
			<div class="flex items-center gap-3">
				<span class="text-[13px] font-semibold text-text-primary">
					{selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}
				</span>
				<button onclick={selectAll} class="text-[12px] font-medium text-accent hover:text-accent-hover transition-smooth">Tout sélectionner</button>
				<button onclick={clearSelection} class="text-[12px] font-medium text-text-muted hover:text-text-primary transition-smooth">Annuler</button>
			</div>
			<div class="flex items-center gap-2">
				<div class="relative">
					<button
						onclick={() => (showBatchCategorize = !showBatchCategorize)}
						class="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover"
					>
						<Tag size={13} /> Catégoriser
					</button>
					{#if showBatchCategorize}
						<div class="absolute right-0 top-full z-20 mt-1.5 max-h-64 w-60 overflow-y-auto glass-card shadow-2xl animate-scale-in p-1">
							<button
								onclick={() => handleBatchCategorize(null)}
								class="w-full rounded-lg px-3 py-2 text-left text-[13px] text-text-muted hover:bg-bg-hover transition-smooth"
							>
								Aucune catégorie
							</button>
							{#each budgetStore.series as series}
								<button
									onclick={() => handleBatchCategorize(series.id)}
									class="w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-text-primary hover:bg-bg-hover transition-smooth"
								>
									{series.name}
								</button>
								{#each budgetStore.getSubSeries(series.id) as sub}
									<button
										onclick={() => handleBatchCategorize(series.id, sub.id)}
										class="w-full rounded-lg py-1.5 pl-7 pr-3 text-left text-[13px] text-text-secondary hover:bg-bg-hover transition-smooth"
									>
										{sub.name}
									</button>
								{/each}
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if transactionStore.loading}
		<LoadingSpinner message="Chargement des transactions..." />
	{:else}

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-3">
		<div class="relative flex-1 min-w-[200px]">
			<Search size={15} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
			<input
				bind:value={transactionStore.search}
				oninput={handleSearchInput}
				onkeydown={(e) => { if (e.key === 'Enter') { showSuggestions = false; handleSearch(); } }}
				onfocus={handleSearchInput}
				onblur={() => setTimeout(() => (showSuggestions = false), 200)}
				placeholder="Rechercher une transaction..."
				class="w-full rounded-xl border border-border bg-bg-card/60 py-2.5 pl-10 pr-4 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted"
			/>
			{#if showSuggestions && suggestions.length > 0}
				<div class="absolute left-0 top-full z-20 mt-1 w-full glass-card shadow-2xl animate-scale-in p-1 max-h-48 overflow-y-auto">
					{#each suggestions as suggestion}
						<button
							onmousedown={() => selectSuggestion(suggestion)}
							class="w-full rounded-lg px-3 py-2 text-left text-[13px] text-text-primary hover:bg-bg-hover transition-smooth truncate"
						>
							{suggestion}
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<select
			bind:value={transactionStore.filterAccountId}
			onchange={handleSearch}
			class="rounded-xl border border-border bg-bg-card/60 px-4 py-2.5 text-[13px] text-text-primary outline-none focus-ring"
		>
			<option value="">Tous les comptes</option>
			{#each accountStore.accounts as account}
				<option value={account.id}>{account.name}</option>
			{/each}
		</select>
		<select
			bind:value={transactionStore.filterSeriesId}
			onchange={handleSearch}
			class="rounded-xl border border-border bg-bg-card/60 px-4 py-2.5 text-[13px] text-text-primary outline-none focus-ring"
		>
			<option value="">Toutes catégories</option>
			{#each budgetStore.series as series}
				<option value={series.id}>{series.name}</option>
			{/each}
		</select>
		<select
			bind:value={transactionStore.filterCategorization}
			onchange={handleSearch}
			class="rounded-xl border border-border bg-bg-card/60 px-4 py-2.5 text-[13px] text-text-primary outline-none focus-ring"
		>
			<option value="">Catégorisation</option>
			<option value="categorized">Catégorisées</option>
			<option value="uncategorized">Non catégorisées</option>
		</select>
		<select
			bind:value={transactionStore.filterReconciled}
			onchange={handleSearch}
			class="rounded-xl border border-border bg-bg-card/60 px-4 py-2.5 text-[13px] text-text-primary outline-none focus-ring"
		>
			<option value="">Pointage</option>
			<option value="yes">Pointées</option>
			<option value="no">Non pointées</option>
		</select>
		{#if transactionStore.search || transactionStore.filterAccountId || transactionStore.filterSeriesId || transactionStore.filterCategorization || transactionStore.filterReconciled || transactionStore.filterDateFrom || transactionStore.filterDateTo || transactionStore.filterAmountMin || transactionStore.filterAmountMax}
			<button onclick={clearFilters} class="text-[12px] font-medium text-accent hover:text-accent-hover transition-smooth">
				Effacer
			</button>
		{/if}
	</div>

	<!-- Date range filter with presets -->
	<div class="flex items-center gap-3 flex-wrap">
		<div class="flex items-center gap-1.5 rounded-xl bg-bg-card/40 p-1">
			{#each [
				{ label: 'Ce mois', fn: () => { const now = new Date(); transactionStore.filterDateFrom = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`; transactionStore.filterDateTo = ''; } },
				{ label: 'Mois dernier', fn: () => { const now = new Date(); const prev = new Date(now.getFullYear(), now.getMonth()-1, 1); transactionStore.filterDateFrom = prev.toISOString().slice(0,10); transactionStore.filterDateTo = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`; } },
				{ label: '3 mois', fn: () => { const now = new Date(); const past = new Date(now.getFullYear(), now.getMonth()-3, 1); transactionStore.filterDateFrom = past.toISOString().slice(0,10); transactionStore.filterDateTo = ''; } },
				{ label: 'Tout', fn: () => { transactionStore.filterDateFrom = ''; transactionStore.filterDateTo = ''; } },
			] as preset}
				<button
					onclick={() => { preset.fn(); handleSearch(); }}
					class="rounded-lg px-3 py-1.5 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth"
				>
					{preset.label}
				</button>
			{/each}
		</div>
		<input
			type="date"
			bind:value={transactionStore.filterDateFrom}
			onchange={handleSearch}
			class="rounded-xl border border-border bg-bg-card/60 px-3 py-2 text-[12px] text-text-primary outline-none focus-ring"
			title="Date de début"
		/>
		<span class="text-[12px] text-text-muted">à</span>
		<input
			type="date"
			bind:value={transactionStore.filterDateTo}
			onchange={handleSearch}
			class="rounded-xl border border-border bg-bg-card/60 px-3 py-2 text-[12px] text-text-primary outline-none focus-ring"
			title="Date de fin"
		/>
		<div class="flex items-center gap-2">
			<input
				type="number"
				step="0.01"
				bind:value={transactionStore.filterAmountMin}
				onchange={handleSearch}
				class="w-28 rounded-xl border border-border bg-bg-card/60 px-3 py-2 text-[12px] text-text-primary outline-none focus-ring"
				placeholder="Min €"
				title="Montant minimum"
			/>
			<span class="text-[12px] text-text-muted">à</span>
			<input
				type="number"
				step="0.01"
				bind:value={transactionStore.filterAmountMax}
				onchange={handleSearch}
				class="w-28 rounded-xl border border-border bg-bg-card/60 px-3 py-2 text-[12px] text-text-primary outline-none focus-ring"
				placeholder="Max €"
				title="Montant maximum"
			/>
		</div>
	</div>

	<!-- Transaction summary + categorization gauge -->
	{#if filteredTransactions.length > 0}
		{@const totalIn = filteredTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)}
		{@const totalOut = filteredTransactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)}
		{@const categorizedCount = filteredTransactions.filter(t => t.series_id !== null).length}
		{@const categorizationPct = filteredTransactions.length === 0 ? 100 : Math.round((categorizedCount / filteredTransactions.length) * 100)}
		<div class="flex items-center gap-6 text-[12px] tabular-nums flex-wrap">
			<span class="text-text-muted">{filteredTransactions.length} opérations</span>
			<span class="text-income font-medium">+{confidentialStore.format(totalIn)}</span>
			<span class="text-expense font-medium">{confidentialStore.format(totalOut)}</span>
			<span class="font-semibold {totalIn + totalOut >= 0 ? 'text-income' : 'text-expense'}">= {confidentialStore.format(totalIn + totalOut)}</span>
			<!-- Categorization gauge -->
			<div class="flex items-center gap-2 ml-auto">
				<span class="text-text-muted text-[11px]">Catégorisées</span>
				<div class="h-[5px] w-20 rounded-full bg-bg-elevated overflow-hidden">
					<div
						class="h-full rounded-full transition-all duration-500 {categorizationPct === 100 ? 'bg-income' : categorizationPct >= 80 ? 'bg-accent' : 'bg-warning'}"
						style="width: {categorizationPct}%"
					></div>
				</div>
				<span class="font-semibold text-[11px] {categorizationPct === 100 ? 'text-income' : categorizationPct >= 80 ? 'text-accent' : 'text-warning'}">{categorizationPct}%</span>
			</div>
		</div>
	{/if}

	<!-- Transaction list -->
	{#if filteredTransactions.length === 0 && !transactionStore.loading}
		<div class="flex flex-col items-center justify-center glass-card p-16">
			<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-bg-elevated">
				<Upload size={32} class="text-text-muted" strokeWidth={1.5} />
			</div>
			<p class="text-xl font-semibold text-text-primary">Aucune transaction</p>
			<p class="mt-1 text-sm text-text-muted">Ajoutez une transaction ou importez un fichier bancaire</p>
		</div>
	{:else}
		<div class="glass-card overflow-hidden">
			<!-- Desktop table -->
			<div class="hidden md:block">
				<table class="w-full">
					<thead>
						<tr class="border-b border-border-light text-left text-[12px] font-semibold text-text-muted uppercase tracking-wider">
							<th class="px-3 py-3.5 w-8">
								<input
									type="checkbox"
									checked={selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0}
									onchange={() => selectedIds.size === filteredTransactions.length ? clearSelection() : selectAll()}
									class="accent-accent rounded"
									aria-label="Tout sélectionner"
								/>
							</th>
							<th class="px-3 py-3.5 w-10"></th>
							<th class="px-5 py-3.5">Date</th>
							<th class="px-5 py-3.5">Libellé</th>
							<th class="px-5 py-3.5">Compte</th>
							<th class="px-5 py-3.5">Catégorie</th>
							<th class="px-5 py-3.5 text-right">Montant</th>
							<th class="px-5 py-3.5 w-20"></th>
						</tr>
					</thead>
					<tbody>
						{#each filteredTransactions as tx (tx.id)}
							<tr class="border-b border-border-light/50 hover-row {selectedIds.has(tx.id) ? 'bg-accent/5' : ''}">
								<td class="px-3 py-3.5">
									<input
										type="checkbox"
										checked={selectedIds.has(tx.id)}
										onchange={() => toggleSelect(tx.id)}
										class="accent-accent rounded"
										aria-label="Sélectionner {tx.label}"
									/>
								</td>
								<td class="px-3 py-3.5">
									<button
										onclick={() => toggleReconciled(tx)}
										class="rounded-lg p-1 transition-smooth {tx.is_reconciled ? 'text-income' : 'text-text-muted/40 hover:text-text-muted'}"
										title={tx.is_reconciled ? 'Pointée — cliquer pour annuler' : 'Non pointée — cliquer pour pointer'}
										aria-label={tx.is_reconciled ? 'Annuler le pointage' : 'Pointer la transaction'}
									>
										{#if tx.is_reconciled}
											<CheckCircle2 size={16} strokeWidth={2.2} />
										{:else}
											<Circle size={16} />
										{/if}
									</button>
								</td>
								<td class="px-5 py-3.5 text-[13px] text-text-muted tabular-nums">{formatDate(tx.date)}</td>
								<td class="px-5 py-3.5">
									<p class="text-[13px] font-medium text-text-primary">
										{tx.label}
										{#if splitStore.hasSplits(tx.id)}
											<span class="badge bg-purple/10 text-purple ml-1.5">
												<Scissors size={9} />Ventilé
											</span>
										{/if}
									</p>
									{#if tx.note}
										<p class="text-[11px] text-text-muted mt-0.5">{tx.note}</p>
									{/if}
								</td>
								<td class="px-5 py-3.5 text-[13px] text-text-muted">{tx.account_name ?? ''}</td>
								<td class="px-5 py-3.5">
									<div class="relative">
										<button
											onclick={() => (categorizingId = categorizingId === tx.id ? null : tx.id)}
											class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-smooth
												{tx.series_name
												? 'bg-accent/10 text-accent hover:bg-accent/15'
												: 'bg-bg-elevated text-text-muted hover:text-text-primary hover:bg-bg-hover'}"
										>
											<Tag size={11} />
											{tx.series_name ?? 'Non catégorisée'}{#if tx.sub_series_name} › {tx.sub_series_name}{/if}
											{#if tx.is_auto_categorized}
												<span class="badge bg-accent/15 text-accent">Auto</span>
											{/if}
										</button>
										{#if categorizingId === tx.id}
											<div class="absolute left-0 top-full z-10 mt-1.5 max-h-64 w-60 overflow-y-auto glass-card shadow-2xl animate-scale-in p-1">
												<button
													onclick={() => handleCategorize(tx.id, null)}
													class="w-full rounded-lg px-3 py-2 text-left text-[13px] text-text-muted hover:bg-bg-hover transition-smooth"
												>
													Aucune catégorie
												</button>
												{#each budgetStore.series as series}
													<button
														onclick={() => handleCategorize(tx.id, series.id)}
														class="w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-text-primary hover:bg-bg-hover transition-smooth"
													>
														{series.name}
													</button>
													{#each budgetStore.getSubSeries(series.id) as sub}
														<button
															onclick={() => handleCategorize(tx.id, series.id, sub.id)}
															class="w-full rounded-lg py-1.5 pl-7 pr-3 text-left text-[13px] text-text-secondary hover:bg-bg-hover transition-smooth"
														>
															{sub.name}
														</button>
													{/each}
												{/each}
											</div>
										{/if}
									</div>
								</td>
								<td class="px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums {tx.amount >= 0 ? 'text-income' : 'text-expense'}">
									{confidentialStore.format(tx.amount)}
								</td>
								<td class="px-5 py-3.5">
									<div class="flex gap-0.5 opacity-0 transition-smooth group-hover:opacity-100" style="opacity: 1;">
										<button onclick={() => (splittingTx = tx)} class="rounded-lg p-1.5 text-text-muted hover:text-purple hover:bg-purple/10 transition-smooth" title="Ventiler" aria-label="Ventiler la transaction {tx.label}">
											<Scissors size={14} />
										</button>
										<button onclick={() => openEdit(tx)} class="rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth" aria-label="Modifier">
											<Pencil size={14} />
										</button>
										<button onclick={() => { if (confirm('Supprimer cette transaction ?')) transactionStore.remove(tx.id); }} class="rounded-lg p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-smooth" aria-label="Supprimer">
											<Trash2 size={14} />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile list -->
			<div class="md:hidden divide-y divide-border-light/50">
				{#each filteredTransactions as tx (tx.id)}
					<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
					<div
						class="flex items-center gap-3 px-4 py-3.5 transition-smooth active:bg-bg-hover/50"
						role="button" tabindex="0"
						onclick={() => openEdit(tx)}
						onkeydown={(e) => e.key === "Enter" && openEdit(tx)}
					>
						<!-- Reconciliation dot -->
						<div class="shrink-0">
							{#if tx.is_reconciled}
								<div class="h-2 w-2 rounded-full bg-income"></div>
							{:else}
								<div class="h-2 w-2 rounded-full bg-border"></div>
							{/if}
						</div>

						<!-- Content -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<p class="text-[14px] font-medium text-text-primary truncate">{tx.label}</p>
								{#if tx.is_auto_categorized}
									<span class="badge bg-accent/15 text-accent text-[9px]">Auto</span>
								{/if}
								{#if splitStore.hasSplits(tx.id)}
									<span class="badge bg-purple/10 text-purple text-[9px]">
										<Scissors size={8} />
									</span>
								{/if}
							</div>
							<p class="text-[11px] text-text-muted mt-0.5">
								{formatDateShort(tx.date)}
								{#if tx.account_name} · {tx.account_name}{/if}
								{#if tx.series_name}
									<span class="text-accent/70"> · {tx.series_name}</span>
								{/if}
							</p>
						</div>

						<!-- Amount -->
						<span class="ml-2 text-[15px] font-bold tabular-nums whitespace-nowrap {tx.amount >= 0 ? 'text-income' : 'text-expense'}">
							{confidentialStore.format(tx.amount)}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{/if}
</div>

<!-- Modal add/edit -->
{#if showForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={() => (showForm = false)}></div>
		<div class="relative w-full max-w-md glass-card p-7 shadow-2xl animate-modal-in mx-4">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-bold tracking-tight text-text-primary">
					{editingId ? 'Modifier' : 'Nouvelle transaction'}
				</h2>
				<button onclick={() => (showForm = false)} class="rounded-xl p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
					<X size={18} />
				</button>
			</div>

			<form onsubmit={handleSubmit} class="space-y-5">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="tx-date" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Date *</label>
						<input id="tx-date" type="date" bind:value={formDate} required
							class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring" />
					</div>
					<div>
						<label for="tx-amount" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Montant *</label>
						<input id="tx-amount" type="number" step="0.01" bind:value={formAmount} required
							class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring" />
					</div>
				</div>

				<div>
					<label for="tx-label" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Libellé *</label>
					<input id="tx-label" bind:value={formLabel} required
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted"
						placeholder="Courses Carrefour" />
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="tx-account" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Compte *</label>
						<select id="tx-account" bind:value={formAccountId} required
							class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring">
							{#each accountStore.accounts as account}
								<option value={account.id}>{account.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="tx-series" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Catégorie</label>
						<select id="tx-series" bind:value={formSeriesId}
							class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring">
							<option value="">Aucune</option>
							{#each budgetStore.series as series}
								<option value={series.id}>{series.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<div>
					<label for="tx-note" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Note</label>
					<input id="tx-note" bind:value={formNote}
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted"
						placeholder="Note optionnelle" />
				</div>

				<div class="flex justify-end gap-3 pt-3">
					<button type="button" onclick={() => (showForm = false)} class="rounded-xl px-5 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-smooth">
						Annuler
					</button>
					<button type="submit" class="rounded-xl bg-accent px-6 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20">
						{editingId ? 'Enregistrer' : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

	{#if transactionStore.hasMore}
		<div class="flex justify-center py-6">
			<button
				onclick={() => transactionStore.loadMore()}
				disabled={transactionStore.loadingMore}
				class="flex items-center gap-2 rounded-xl border border-border px-8 py-3 text-[13px] font-medium text-text-secondary transition-smooth btn-press hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
			>
				{#if transactionStore.loadingMore}
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-accent/20 border-t-accent"></div>
					Chargement...
				{:else}
					Charger plus ({transactionStore.totalCount - filteredTransactions.length} restantes)
				{/if}
			</button>
		</div>
	{/if}

{#if splittingTx}
	<SplitModal
		transaction={splittingTx}
		onclose={() => { splittingTx = null; transactionStore.load(); splitStore.loadBatchStatus(); }}
	/>
{/if}
