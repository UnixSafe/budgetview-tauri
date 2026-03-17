<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { open } from '@tauri-apps/plugin-dialog';
	import {
		Upload,
		FileText,
		CheckCircle2,
		AlertTriangle,
		X,
		ArrowLeft,
		ChevronDown,
		ChevronUp
	} from 'lucide-svelte';
	import { importStore, type RawTransaction } from '$lib/stores/import.svelte';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { formatCurrency, formatDate, toCents } from '$lib/utils/format';

	// State
	let selectedAccountId = $state<number | null>(null);
	let createNewAccount = $state(false);
	let newAccountName = $state('');
	let showAllTransactions = $state(false);
	let step = $state<'select' | 'preview' | 'done'>('select');

	onMount(async () => {
		importStore.reset();
		await accountStore.load();
	});

	async function pickFile() {
		const filePath = await open({
			multiple: false,
			filters: [
				{
					name: 'Fichiers bancaires',
					extensions: ['ofx', 'qif', 'csv', 'OFX', 'QIF', 'CSV']
				}
			]
		});

		if (!filePath) return;

		await importStore.loadPreview(filePath as string);

		if (importStore.preview) {
			step = 'preview';

			// If OFX provided an account number, try to match
			if (importStore.preview.account_number) {
				const match = accountStore.accounts.find(
					(a: { account_number: string | null }) => a.account_number === importStore.preview!.account_number
				);
				if (match) {
					selectedAccountId = match.id;
				} else {
					createNewAccount = true;
					newAccountName = importStore.preview.account_number;
				}
			} else if (accountStore.accounts.length === 1) {
				selectedAccountId = accountStore.accounts[0].id;
			}
		}
	}

	async function handleImport() {
		let accountId = selectedAccountId;

		// Create account if needed
		if (createNewAccount && newAccountName.trim()) {
			await accountStore.create({
				name: newAccountName.trim(),
				account_number: importStore.preview?.account_number ?? undefined,
				bank_name: importStore.preview?.bank_id ?? undefined,
				account_type: 'checking',
				initial_balance: 0
			});
			await accountStore.load();
			accountId = accountStore.accounts[accountStore.accounts.length - 1]?.id ?? null;
		}

		if (!accountId) return;

		await importStore.confirmImport(accountId);

		if (importStore.result && !importStore.error) {
			step = 'done';
		}
	}

	function formatLabel(format: string): string {
		switch (format) {
			case 'ofx':
				return 'OFX (Open Financial Exchange)';
			case 'qif':
				return 'QIF (Quicken)';
			case 'csv':
				return 'CSV (Tableur)';
			default:
				return format.toUpperCase();
		}
	}

	function goToTransactions() {
		goto('/transactions');
	}

	function startOver() {
		importStore.reset();
		step = 'select';
		selectedAccountId = null;
		createNewAccount = false;
		newAccountName = '';
	}

	// Derived
	let displayedTransactions = $derived(
		showAllTransactions
			? importStore.preview?.transactions ?? []
			: (importStore.preview?.transactions ?? []).slice(0, 20)
	);

	let duplicateSet = $derived(new Set(importStore.preview?.duplicates ?? []));
</script>

<svelte:head>
	<title>Import — BudgetView</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center gap-3">
		<a href="/transactions" class="rounded-lg p-2 text-text-muted hover:bg-bg-hover hover:text-text-primary">
			<ArrowLeft size={20} />
		</a>
		<h1 class="text-2xl font-bold text-text-primary">Importer des transactions</h1>
	</div>

	{#if importStore.error}
		<div class="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
			<AlertTriangle size={20} class="text-danger" />
			<p class="text-sm text-danger">{importStore.error}</p>
			<button onclick={() => (importStore.error = null)} class="ml-auto text-danger hover:text-danger/70">
				<X size={16} />
			</button>
		</div>
	{/if}

	<!-- Step 1: Sélection fichier -->
	{#if step === 'select'}
		<div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-bg-card p-16">
			<Upload size={56} class="mb-4 text-text-muted" />
			<p class="mb-2 text-lg font-medium text-text-primary">Sélectionnez un fichier bancaire</p>
			<p class="mb-6 text-sm text-text-muted">Formats supportés : OFX, QIF, CSV</p>
			<button
				onclick={pickFile}
				disabled={importStore.loading}
				class="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
			>
				<FileText size={18} />
				{importStore.loading ? 'Chargement...' : 'Choisir un fichier'}
			</button>
		</div>

		<div class="rounded-xl border border-border bg-bg-card p-6">
			<h3 class="mb-3 text-sm font-semibold text-text-primary">Formats supportés</h3>
			<div class="space-y-2 text-sm text-text-secondary">
				<p><strong class="text-text-primary">OFX</strong> — Format standard des banques françaises (Crédit Agricole, BNP, Société Générale...)</p>
				<p><strong class="text-text-primary">QIF</strong> — Format Quicken, supporté par la plupart des banques</p>
				<p><strong class="text-text-primary">CSV</strong> — Export tableur depuis votre banque en ligne (détection automatique des colonnes)</p>
			</div>
		</div>
	{/if}

	<!-- Step 2: Prévisualisation -->
	{#if step === 'preview' && importStore.preview}
		{@const preview = importStore.preview}

		<!-- Résumé -->
		<div class="grid grid-cols-3 gap-4">
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<p class="text-xs font-medium text-text-muted">Format</p>
				<p class="mt-1 text-lg font-semibold text-text-primary">{formatLabel(preview.format)}</p>
			</div>
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<p class="text-xs font-medium text-text-muted">Transactions</p>
				<p class="mt-1 text-lg font-semibold text-text-primary">{preview.total_count}</p>
			</div>
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<p class="text-xs font-medium text-text-muted">Nouvelles</p>
				<p class="mt-1 text-lg font-semibold text-income">{preview.new_count}</p>
				{#if preview.duplicates.length > 0}
					<p class="text-xs text-warning">{preview.duplicates.length} doublon(s) détecté(s)</p>
				{/if}
			</div>
		</div>

		{#if preview.account_number}
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<p class="text-xs font-medium text-text-muted">Compte détecté dans le fichier</p>
				<p class="mt-1 text-sm text-text-primary">
					N° {preview.account_number}
					{#if preview.bank_id}
						— Banque {preview.bank_id}
					{/if}
				</p>
			</div>
		{/if}

		<!-- Sélection du compte -->
		<div class="rounded-xl border border-border bg-bg-card p-6">
			<h3 class="mb-3 text-sm font-semibold text-text-primary">Importer dans quel compte ?</h3>

			{#if accountStore.accounts.length > 0}
				<div class="space-y-2">
					{#each accountStore.accounts as account}
						<label class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-bg-hover {selectedAccountId === account.id && !createNewAccount ? 'border-accent bg-accent/5' : ''}">
							<input
								type="radio"
								name="account"
								value={account.id}
								checked={selectedAccountId === account.id && !createNewAccount}
								onchange={() => {
									selectedAccountId = account.id;
									createNewAccount = false;
								}}
								class="accent-accent"
							/>
							<div>
								<p class="text-sm font-medium text-text-primary">{account.name}</p>
								{#if account.account_number}
									<p class="text-xs text-text-muted">{account.account_number}</p>
								{/if}
							</div>
						</label>
					{/each}

					<label class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-bg-hover {createNewAccount ? 'border-accent bg-accent/5' : ''}">
						<input
							type="radio"
							name="account"
							checked={createNewAccount}
							onchange={() => {
								createNewAccount = true;
								selectedAccountId = null;
							}}
							class="accent-accent"
						/>
						<span class="text-sm text-text-primary">Créer un nouveau compte</span>
					</label>
				</div>
			{:else}
				<p class="mb-3 text-sm text-text-secondary">Aucun compte existant. Un nouveau compte sera créé.</p>
			{/if}

			{#if createNewAccount || accountStore.accounts.length === 0}
				<div class="mt-3">
					<input
						bind:value={newAccountName}
						placeholder="Nom du compte (ex: Compte courant BNP)"
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
					/>
				</div>
			{/if}
		</div>

		<!-- Aperçu des transactions -->
		<div class="rounded-xl border border-border">
			<div class="flex items-center justify-between border-b border-border bg-bg-card px-4 py-3">
				<h3 class="text-sm font-semibold text-text-primary">Aperçu des transactions</h3>
				{#if preview.transactions.length > 20}
					<button
						onclick={() => (showAllTransactions = !showAllTransactions)}
						class="flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
					>
						{showAllTransactions ? 'Réduire' : `Voir les ${preview.transactions.length} transactions`}
						{#if showAllTransactions}
							<ChevronUp size={14} />
						{:else}
							<ChevronDown size={14} />
						{/if}
					</button>
				{/if}
			</div>
			<table class="w-full">
				<thead>
					<tr class="border-b border-border bg-bg-secondary text-left text-xs text-text-secondary">
						<th class="px-4 py-2 font-medium">Statut</th>
						<th class="px-4 py-2 font-medium">Date</th>
						<th class="px-4 py-2 font-medium">Libellé</th>
						<th class="px-4 py-2 text-right font-medium">Montant</th>
					</tr>
				</thead>
				<tbody>
					{#each displayedTransactions as tx, i}
						{@const isDuplicate = duplicateSet.has(i)}
						<tr class="border-b border-border text-sm {isDuplicate ? 'opacity-40' : ''}">
							<td class="px-4 py-2">
								{#if isDuplicate}
									<span class="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-xs text-warning">
										<AlertTriangle size={12} />
										Doublon
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 rounded-md bg-income/10 px-2 py-0.5 text-xs text-income">
										<CheckCircle2 size={12} />
										Nouveau
									</span>
								{/if}
							</td>
							<td class="px-4 py-2 text-text-secondary">{formatDate(tx.date)}</td>
							<td class="px-4 py-2 text-text-primary">{tx.label}</td>
							<td class="px-4 py-2 text-right font-medium {tx.amount >= 0 ? 'text-income' : 'text-expense'}">
								{formatCurrency(toCents(tx.amount))}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Actions -->
		<div class="flex items-center justify-between rounded-xl border border-border bg-bg-card p-4">
			<button
				onclick={startOver}
				class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
			>
				Annuler
			</button>
			<button
				onclick={handleImport}
				disabled={importStore.loading || (!selectedAccountId && (!createNewAccount || !newAccountName.trim())) || preview.new_count === 0}
				class="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
			>
				<Upload size={16} />
				{#if importStore.loading}
					Import en cours...
				{:else}
					Importer {preview.new_count} transaction{preview.new_count > 1 ? 's' : ''}
				{/if}
			</button>
		</div>
	{/if}

	<!-- Step 3: Résultat -->
	{#if step === 'done' && importStore.result}
		{@const result = importStore.result}
		<div class="flex flex-col items-center justify-center rounded-xl border border-income/30 bg-income/5 p-12">
			<CheckCircle2 size={56} class="mb-4 text-income" />
			<p class="mb-2 text-lg font-semibold text-text-primary">Import réussi</p>
			<p class="mb-6 text-sm text-text-secondary">
				{result.imported_count} transaction{result.imported_count > 1 ? 's' : ''} importée{result.imported_count > 1 ? 's' : ''}
				{#if result.duplicates_skipped > 0}
					— {result.duplicates_skipped} doublon{result.duplicates_skipped > 1 ? 's' : ''} ignoré{result.duplicates_skipped > 1 ? 's' : ''}
				{/if}
			</p>
			<div class="flex gap-3">
				<button
					onclick={goToTransactions}
					class="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
				>
					Voir les transactions
				</button>
				<button
					onclick={startOver}
					class="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary"
				>
					Importer un autre fichier
				</button>
			</div>
		</div>
	{/if}
</div>
