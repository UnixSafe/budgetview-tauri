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
		ChevronUp,
		Tag
	} from 'lucide-svelte';
	import { importStore } from '$lib/stores/import.svelte';
	import type { RawTransaction } from '$lib/types';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { formatCurrency, formatDate, toCents } from '$lib/utils/format';
	import { confidentialStore } from '$lib/stores/confidential.svelte';

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
			filters: [{ name: 'Fichiers bancaires', extensions: ['ofx', 'qif', 'csv', 'OFX', 'QIF', 'CSV'] }]
		});
		if (!filePath) return;
		await importStore.loadPreview(filePath as string);
		if (importStore.preview) {
			step = 'preview';
			if (importStore.preview.account_number) {
				const match = accountStore.accounts.find((a: { account_number: string | null }) => a.account_number === importStore.preview!.account_number);
				if (match) { selectedAccountId = match.id; }
				else { createNewAccount = true; newAccountName = importStore.preview.account_number; }
			} else if (accountStore.accounts.length === 1) {
				selectedAccountId = accountStore.accounts[0].id;
			}
		}
	}

	async function handleImport() {
		let accountId = selectedAccountId;
		if (createNewAccount && newAccountName.trim()) {
			const newId = await accountStore.create({
				name: newAccountName.trim(),
				account_number: importStore.preview?.account_number ?? undefined,
				bank_name: importStore.preview?.bank_id ?? undefined,
				account_type: 'checking', initial_balance: 0
			});
			accountId = newId;
		}
		if (!accountId) return;
		await importStore.confirmImport(accountId);
		if (importStore.result && !importStore.error) { step = 'done'; }
	}

	function formatLabel(format: string): string {
		switch (format) {
			case 'ofx': return 'OFX (Open Financial Exchange)';
			case 'qif': return 'QIF (Quicken)';
			case 'csv': return 'CSV (Tableur)';
			default: return format.toUpperCase();
		}
	}

	function goToTransactions() { goto('/transactions'); }
	function startOver() { importStore.reset(); step = 'select'; selectedAccountId = null; createNewAccount = false; newAccountName = ''; }

	let displayedTransactions = $derived(
		showAllTransactions ? importStore.preview?.transactions ?? [] : (importStore.preview?.transactions ?? []).slice(0, 20)
	);
	let duplicateSet = $derived(new Set(importStore.preview?.duplicates ?? []));
</script>

<svelte:head>
	<title>Import — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a href="/transactions" class="rounded-xl p-2.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-smooth">
			<ArrowLeft size={20} />
		</a>
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Importer</h1>
			<p class="mt-0.5 text-sm text-text-muted">Importez vos relevés bancaires</p>
		</div>
	</div>

	{#if importStore.error}
		<div class="flex items-center gap-3 glass-card border-danger/20 p-5 animate-slide-up">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-danger/15">
				<AlertTriangle size={16} class="text-danger" />
			</div>
			<p class="flex-1 text-[13px] font-medium text-danger">{importStore.error}</p>
			<button onclick={() => (importStore.error = null)} class="rounded-full p-1.5 text-danger/50 hover:text-danger transition-smooth">
				<X size={15} />
			</button>
		</div>
	{/if}

	{#if step === 'select'}
		<div class="flex flex-col items-center justify-center glass-card p-20 border-2 border-dashed border-border">
			<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10">
				<Upload size={36} class="text-accent" strokeWidth={1.5} />
			</div>
			<p class="text-xl font-semibold text-text-primary">Sélectionnez un fichier</p>
			<p class="mt-1 mb-8 text-sm text-text-muted">OFX · QIF · CSV</p>
			<button onclick={pickFile} disabled={importStore.loading}
				class="flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-[14px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20 disabled:opacity-40">
				<FileText size={18} />
				{importStore.loading ? 'Chargement...' : 'Choisir un fichier'}
			</button>
		</div>

		<div class="glass-card p-6">
			<h3 class="mb-4 text-[14px] font-semibold text-text-primary">Formats supportés</h3>
			<div class="space-y-3 text-[13px] text-text-secondary">
				<p><strong class="text-text-primary">OFX</strong> — Format standard des banques françaises</p>
				<p><strong class="text-text-primary">QIF</strong> — Format Quicken, supporté par la plupart des banques</p>
				<p><strong class="text-text-primary">CSV</strong> — Export tableur (détection automatique des colonnes)</p>
			</div>
		</div>
	{/if}

	{#if step === 'preview' && importStore.preview}
		{@const preview = importStore.preview}

		<div class="grid grid-cols-3 gap-3 stagger-children">
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Format</p>
				<p class="mt-2 text-lg font-bold text-text-primary">{formatLabel(preview.format)}</p>
			</div>
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total</p>
				<p class="mt-2 text-lg font-bold text-text-primary">{preview.total_count}</p>
			</div>
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Nouvelles</p>
				<p class="mt-2 text-lg font-bold text-income">{preview.new_count}</p>
				{#if preview.duplicates.length > 0}
					<p class="text-[11px] text-warning mt-1">{preview.duplicates.length} doublon(s)</p>
				{/if}
			</div>
		</div>

		{#if preview.account_number}
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Compte détecté</p>
				<p class="mt-1 text-[14px] text-text-primary">
					N° {preview.account_number}
					{#if preview.bank_id} — Banque {preview.bank_id}{/if}
				</p>
			</div>
		{/if}

		<div class="glass-card p-6">
			<h3 class="mb-4 text-[14px] font-semibold text-text-primary">Importer dans quel compte ?</h3>
			{#if accountStore.accounts.length > 0}
				<div class="space-y-2">
					{#each accountStore.accounts as account}
						<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-border-light p-4 transition-smooth hover:bg-bg-hover btn-press {selectedAccountId === account.id && !createNewAccount ? 'border-accent bg-accent/5' : ''}">
							<input type="radio" name="account" value={account.id}
								checked={selectedAccountId === account.id && !createNewAccount}
								onchange={() => { selectedAccountId = account.id; createNewAccount = false; }}
								class="accent-accent" />
							<div>
								<p class="text-[14px] font-medium text-text-primary">{account.name}</p>
								{#if account.account_number}
									<p class="text-[11px] text-text-muted">{account.account_number}</p>
								{/if}
							</div>
						</label>
					{/each}
					<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-border-light p-4 transition-smooth hover:bg-bg-hover btn-press {createNewAccount ? 'border-accent bg-accent/5' : ''}">
						<input type="radio" name="account" checked={createNewAccount}
							onchange={() => { createNewAccount = true; selectedAccountId = null; }} class="accent-accent" />
						<span class="text-[14px] text-text-primary">Créer un nouveau compte</span>
					</label>
				</div>
			{:else}
				<p class="mb-3 text-[13px] text-text-secondary">Aucun compte. Un nouveau sera créé.</p>
			{/if}
			{#if createNewAccount || accountStore.accounts.length === 0}
				<div class="mt-3">
					<input bind:value={newAccountName} placeholder="Nom du compte"
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
				</div>
			{/if}
		</div>

		<div class="glass-card overflow-hidden">
			<div class="flex items-center justify-between border-b border-border-light px-5 py-4">
				<h3 class="text-[14px] font-semibold text-text-primary">Aperçu</h3>
				{#if preview.transactions.length > 20}
					<button onclick={() => (showAllTransactions = !showAllTransactions)}
						class="flex items-center gap-1 text-[12px] font-medium text-accent hover:text-accent-hover transition-smooth">
						{showAllTransactions ? 'Réduire' : `Tout afficher (${preview.transactions.length})`}
						{#if showAllTransactions}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
					</button>
				{/if}
			</div>
			<table class="w-full">
				<thead>
					<tr class="border-b border-border-light text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">
						<th class="px-5 py-3">Statut</th>
						<th class="px-5 py-3">Date</th>
						<th class="px-5 py-3">Libellé</th>
						<th class="px-5 py-3 text-right">Montant</th>
					</tr>
				</thead>
				<tbody>
					{#each displayedTransactions as tx, i}
						{@const isDuplicate = duplicateSet.has(i)}
						<tr class="border-b border-border-light/50 text-[13px] hover-row {isDuplicate ? 'opacity-35' : ''}">
							<td class="px-5 py-3">
								{#if isDuplicate}
									<span class="badge bg-warning/10 text-warning"><AlertTriangle size={10} />Doublon</span>
								{:else}
									<span class="badge bg-income/10 text-income"><CheckCircle2 size={10} />Nouveau</span>
								{/if}
							</td>
							<td class="px-5 py-3 text-text-muted tabular-nums">{formatDate(tx.date)}</td>
							<td class="px-5 py-3 text-text-primary">{tx.label}</td>
							<td class="px-5 py-3 text-right font-semibold tabular-nums {tx.amount >= 0 ? 'text-income' : 'text-expense'}">
								{confidentialStore.format(toCents(tx.amount))}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="flex items-center justify-between glass-card p-5">
			<button onclick={startOver} class="rounded-xl px-5 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-smooth">
				Annuler
			</button>
			<button onclick={handleImport}
				disabled={importStore.loading || (!selectedAccountId && (!createNewAccount || !newAccountName.trim())) || preview.new_count === 0}
				class="flex items-center gap-2 rounded-xl bg-accent px-8 py-3 text-[14px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20 disabled:opacity-40">
				<Upload size={16} />
				{importStore.loading ? 'Import...' : `Importer ${preview.new_count} transaction${preview.new_count > 1 ? 's' : ''}`}
			</button>
		</div>
	{/if}

	{#if step === 'done' && importStore.result}
		{@const result = importStore.result}
		<div class="flex flex-col items-center justify-center glass-card p-16 animate-scale-in">
			<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-income/10">
				<CheckCircle2 size={40} class="text-income" strokeWidth={1.5} />
			</div>
			<p class="text-2xl font-bold text-text-primary">Import réussi</p>
			<p class="mt-2 text-[14px] text-text-secondary">
				{result.imported_count} transaction{result.imported_count > 1 ? 's' : ''} importée{result.imported_count > 1 ? 's' : ''}
				{#if result.duplicates_skipped > 0}
					— {result.duplicates_skipped} doublon{result.duplicates_skipped > 1 ? 's' : ''}
				{/if}
			</p>
			{#if result.auto_categorized_count > 0}
				<div class="mt-4 flex items-center gap-2 rounded-xl bg-accent/10 px-5 py-2.5">
					<Tag size={16} class="text-accent" />
					<span class="text-[13px] font-semibold text-accent">{result.auto_categorized_count} auto-catégorisée{result.auto_categorized_count > 1 ? 's' : ''}</span>
				</div>
			{/if}
			<div class="mt-8 flex gap-3">
				<button onclick={goToTransactions} class="rounded-xl bg-accent px-6 py-3 text-[14px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20">
					Voir les transactions
				</button>
				<button onclick={startOver} class="rounded-xl border border-border px-6 py-3 text-[14px] font-medium text-text-secondary transition-smooth hover:text-text-primary">
					Autre import
				</button>
			</div>
		</div>
	{/if}
</div>
