<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { open } from '@tauri-apps/plugin-dialog';
	import { X, Upload, FileText, AlertTriangle, Check, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import { confidentialStore } from '$lib/stores/confidential.svelte';
	import type { ImportPreview, ImportResult, CsvConfig, CsvColumnInfo, Account } from '$lib/types';

	interface Props {
		onclose: () => void;
		onimported: (result: ImportResult) => void;
	}

	let { onclose, onimported }: Props = $props();

	// Steps: 'pick' | 'preview' | 'csv-config' | 'importing' | 'done'
	let step = $state<'pick' | 'preview' | 'csv-config' | 'importing' | 'done'>('pick');
	let filePath = $state('');
	let fileName = $state('');
	let preview = $state<ImportPreview | null>(null);
	let csvInfo = $state<CsvColumnInfo | null>(null);
	let csvConfig = $state<CsvConfig | null>(null);
	let selectedAccountId = $state<number | null>(null);
	let createNewAccount = $state(false);
	let newAccountName = $state('');
	let error = $state('');
	let result = $state<ImportResult | null>(null);

	// Track which transactions user wants to skip (beyond auto-detected dupes)
	let userSkipped = $state<Set<number>>(new Set());

	// Pagination for preview
	let previewPage = $state(0);
	const PAGE_SIZE = 20;

	let paginatedTransactions = $derived(() => {
		if (!preview) return [];
		const start = previewPage * PAGE_SIZE;
		return preview.transactions.slice(start, start + PAGE_SIZE);
	});

	let totalPages = $derived(() => {
		if (!preview) return 0;
		return Math.ceil(preview.transactions.length / PAGE_SIZE);
	});

	let newTransactionCount = $derived(() => {
		if (!preview) return 0;
		const dupeSet = new Set(preview.duplicates);
		return preview.transactions.filter((_, i) => !dupeSet.has(i) && !userSkipped.has(i)).length;
	});

	async function pickFile() {
		error = '';
		try {
			const selected = await open({
				multiple: false,
				filters: [
					{
						name: 'Fichiers bancaires',
						extensions: ['ofx', 'qif', 'csv', 'txt']
					}
				]
			});

			if (!selected) return;

			filePath = selected as string;
			fileName = filePath.split(/[/\\]/).pop() ?? filePath;

			// Check if CSV needs config
			const ext = fileName.toLowerCase().split('.').pop();
			if (ext === 'csv' || ext === 'txt') {
				await loadCsvInfo();
			} else {
				await loadPreview();
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function loadCsvInfo() {
		try {
			csvInfo = await invoke<CsvColumnInfo>('detect_csv_columns', { filePath });
			csvConfig = { ...csvInfo.detected_config };
			step = 'csv-config';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function loadPreview(config?: CsvConfig) {
		error = '';
		try {
			preview = await invoke<ImportPreview>('import_preview', {
				filePath,
				csvConfig: config ?? null
			});
			userSkipped = new Set();
			previewPage = 0;

			// Auto-select account if OFX provides account number
			if (preview.account_number) {
				const match = accountStore.accounts.find(
					(a) => a.account_number === preview!.account_number
				);
				if (match) {
					selectedAccountId = match.id;
				} else {
					createNewAccount = true;
					newAccountName = preview.bank_id
						? `${preview.bank_id} - ${preview.account_number}`
						: `Compte ${preview.account_number}`;
				}
			}

			// Default to first account if none selected
			if (!selectedAccountId && !createNewAccount && accountStore.accounts.length > 0) {
				selectedAccountId = accountStore.accounts[0].id;
			}

			step = 'preview';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	function toggleSkip(index: number) {
		const newSet = new Set(userSkipped);
		if (newSet.has(index)) {
			newSet.delete(index);
		} else {
			newSet.add(index);
		}
		userSkipped = newSet;
	}

	function isDuplicate(index: number): boolean {
		return preview?.duplicates.includes(index) ?? false;
	}

	async function confirmImport() {
		if (!preview) return;
		error = '';

		let accountId = selectedAccountId;

		// Create new account if needed
		if (createNewAccount && newAccountName.trim()) {
			try {
				await accountStore.create({
					name: newAccountName.trim(),
					account_type: 'checking',
					initial_balance: 0,
					account_number: preview.account_number ?? undefined,
					bank_name: preview.bank_id ?? undefined
				});
				// Get the newly created account
				const created = accountStore.accounts.find((a) => a.name === newAccountName.trim());
				if (created) {
					accountId = created.id;
				}
			} catch (e) {
				error = `Erreur création compte : ${e instanceof Error ? e.message : String(e)}`;
				return;
			}
		}

		if (!accountId) {
			error = 'Veuillez sélectionner un compte';
			return;
		}

		step = 'importing';

		try {
			const skipIndices = [...userSkipped];
			result = await invoke<ImportResult>('import_confirm', {
				filePath,
				accountId,
				csvConfig: csvConfig ?? null,
				skipIndices
			});
			step = 'done';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			step = 'preview';
		}
	}

	function finish() {
		if (result) {
			onimported(result);
		}
		onclose();
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
	<div class="absolute inset-0" onclick={onclose} role="none"></div>
	<div
		class="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-bg-secondary shadow-xl"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-border px-6 py-4">
			<div class="flex items-center gap-3">
				<Upload size={20} class="text-accent" />
				<h2 class="text-lg font-semibold text-text-primary">
					{#if step === 'pick'}
						Importer un fichier bancaire
					{:else if step === 'csv-config'}
						Configuration CSV
					{:else if step === 'preview'}
						Aperçu de l'import
					{:else if step === 'importing'}
						Import en cours...
					{:else}
						Import terminé
					{/if}
				</h2>
			</div>
			<button onclick={onclose} class="text-text-muted hover:text-text-primary">
				<X size={20} />
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6">
			{#if error}
				<div
					class="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
				>
					<AlertTriangle size={16} />
					{error}
				</div>
			{/if}

			{#if step === 'pick'}
				<!-- File picker -->
				<div class="flex flex-col items-center justify-center py-12">
					<div
						class="mb-6 rounded-full bg-accent/10 p-6"
					>
						<FileText size={48} class="text-accent" />
					</div>
					<p class="mb-2 text-lg font-medium text-text-primary">
						Sélectionnez un fichier à importer
					</p>
					<p class="mb-6 text-sm text-text-muted">
						Formats supportés : OFX, QIF, CSV
					</p>
					<button
						onclick={pickFile}
						class="rounded-lg bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent-hover"
					>
						Choisir un fichier
					</button>
				</div>

			{:else if step === 'csv-config'}
				<!-- CSV column configuration -->
				{#if csvInfo && csvConfig}
					<div class="space-y-4">
						<p class="text-sm text-text-secondary">
							Fichier : <span class="font-medium text-text-primary">{fileName}</span>
						</p>

						<!-- Sample data preview -->
						<div class="overflow-hidden rounded-lg border border-border">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-border bg-bg-primary">
										{#each csvInfo.headers as header, i}
											<th class="px-3 py-2 text-left font-medium text-text-secondary">
												<span class="text-xs text-text-muted">Col {i}</span><br />
												{header}
											</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each csvInfo.sample_rows as row}
										<tr class="border-b border-border">
											{#each row as cell}
												<td class="px-3 py-2 text-text-primary">{cell}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Column mapping -->
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="csv-delimiter" class="mb-1 block text-sm font-medium text-text-secondary"
									>Séparateur</label
								>
								<select
									id="csv-delimiter"
									bind:value={csvConfig.delimiter}
									class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
								>
									<option value=";">Point-virgule (;)</option>
									<option value=",">Virgule (,)</option>
									<option value={'\t'}>Tabulation</option>
								</select>
							</div>
							<div>
								<label for="csv-decimal" class="mb-1 block text-sm font-medium text-text-secondary"
									>Séparateur décimal</label
								>
								<select
									id="csv-decimal"
									bind:value={csvConfig.decimal_separator}
									class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
								>
									<option value=",">Virgule (,) — français</option>
									<option value=".">Point (.) — anglais</option>
								</select>
							</div>
							<div>
								<label for="csv-date-col" class="mb-1 block text-sm font-medium text-text-secondary"
									>Colonne date</label
								>
								<select
									id="csv-date-col"
									bind:value={csvConfig.date_column}
									class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
								>
									{#each csvInfo.headers as header, i}
										<option value={i}>{i} — {header}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="csv-label-col" class="mb-1 block text-sm font-medium text-text-secondary"
									>Colonne libellé</label
								>
								<select
									id="csv-label-col"
									bind:value={csvConfig.label_column}
									class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
								>
									{#each csvInfo.headers as header, i}
										<option value={i}>{i} — {header}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="csv-amount-col" class="mb-1 block text-sm font-medium text-text-secondary"
									>Colonne montant</label
								>
								<select
									id="csv-amount-col"
									bind:value={csvConfig.amount_column}
									class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
								>
									<option value={-1}>— Débit/Crédit séparés —</option>
									{#each csvInfo.headers as header, i}
										<option value={i}>{i} — {header}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="csv-date-fmt" class="mb-1 block text-sm font-medium text-text-secondary"
									>Format date</label
								>
								<select
									id="csv-date-fmt"
									bind:value={csvConfig.date_format}
									class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
								>
									<option value="%d/%m/%Y">JJ/MM/AAAA</option>
									<option value="%Y-%m-%d">AAAA-MM-JJ</option>
									<option value="%d-%m-%Y">JJ-MM-AAAA</option>
									<option value="%d.%m.%Y">JJ.MM.AAAA</option>
								</select>
							</div>
						</div>

						{#if csvConfig.amount_column === -1}
							<div class="grid grid-cols-2 gap-4">
								<div>
									<label for="csv-debit-col" class="mb-1 block text-sm font-medium text-text-secondary"
										>Colonne débit</label
									>
									<select
										id="csv-debit-col"
										bind:value={csvConfig.debit_column}
										class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
									>
										{#each csvInfo.headers as header, i}
											<option value={i}>{i} — {header}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="csv-credit-col" class="mb-1 block text-sm font-medium text-text-secondary"
										>Colonne crédit</label
									>
									<select
										id="csv-credit-col"
										bind:value={csvConfig.credit_column}
										class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
									>
										{#each csvInfo.headers as header, i}
											<option value={i}>{i} — {header}</option>
										{/each}
									</select>
								</div>
							</div>
						{/if}

						<div class="flex justify-end gap-3 pt-2">
							<button
								onclick={() => (step = 'pick')}
								class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
							>
								Retour
							</button>
							<button
								onclick={() => loadPreview(csvConfig!)}
								class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
							>
								Aperçu
							</button>
						</div>
					</div>
				{/if}

			{:else if step === 'preview'}
				<!-- Preview transactions -->
				{#if preview}
					<div class="space-y-4">
						<!-- Summary -->
						<div class="flex flex-wrap gap-4">
							<div class="rounded-lg bg-bg-primary px-4 py-3">
								<p class="text-xs text-text-muted">Fichier</p>
								<p class="text-sm font-medium text-text-primary">{fileName}</p>
							</div>
							<div class="rounded-lg bg-bg-primary px-4 py-3">
								<p class="text-xs text-text-muted">Format</p>
								<p class="text-sm font-medium text-text-primary uppercase">{preview.format}</p>
							</div>
							<div class="rounded-lg bg-bg-primary px-4 py-3">
								<p class="text-xs text-text-muted">Total</p>
								<p class="text-sm font-medium text-text-primary">{preview.total_count} transactions</p>
							</div>
							<div class="rounded-lg bg-bg-primary px-4 py-3">
								<p class="text-xs text-text-muted">Doublons détectés</p>
								<p class="text-sm font-medium text-warning">{preview.duplicates.length}</p>
							</div>
							<div class="rounded-lg bg-bg-primary px-4 py-3">
								<p class="text-xs text-text-muted">À importer</p>
								<p class="text-sm font-medium text-income">{newTransactionCount()}</p>
							</div>
						</div>

						<!-- Account selection -->
						<div class="rounded-lg border border-border bg-bg-primary p-4">
							<p class="mb-2 text-sm font-medium text-text-secondary">Compte de destination</p>
							{#if preview.account_number}
								<p class="mb-2 text-xs text-text-muted">
									N° de compte détecté : {preview.account_number}
									{#if preview.bank_id} (Banque : {preview.bank_id}){/if}
								</p>
							{/if}

							<div class="flex items-center gap-4">
								<label class="flex items-center gap-2 text-sm text-text-primary">
									<input
										type="radio"
										bind:group={createNewAccount}
										value={false}
										class="text-accent"
									/>
									Compte existant
								</label>
								<label class="flex items-center gap-2 text-sm text-text-primary">
									<input
										type="radio"
										bind:group={createNewAccount}
										value={true}
										class="text-accent"
									/>
									Nouveau compte
								</label>
							</div>

							{#if createNewAccount}
								<input
									bind:value={newAccountName}
									placeholder="Nom du nouveau compte"
									class="mt-2 w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
								/>
							{:else}
								<select
									bind:value={selectedAccountId}
									class="mt-2 w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
								>
									{#each accountStore.accounts as account}
										<option value={account.id}>{account.name}</option>
									{/each}
								</select>
							{/if}
						</div>

						<!-- Transaction table -->
						<div class="overflow-hidden rounded-lg border border-border">
							<table class="w-full text-sm">
								<thead>
									<tr
										class="border-b border-border bg-bg-primary text-left text-text-secondary"
									>
										<th class="w-10 px-3 py-2"></th>
										<th class="px-3 py-2 font-medium">Date</th>
										<th class="px-3 py-2 font-medium">Libellé</th>
										<th class="px-3 py-2 text-right font-medium">Montant</th>
										<th class="w-20 px-3 py-2 font-medium">Statut</th>
									</tr>
								</thead>
								<tbody>
									{#each paginatedTransactions() as tx, localIdx}
										{@const globalIdx = previewPage * PAGE_SIZE + localIdx}
										{@const dupe = isDuplicate(globalIdx)}
										{@const skipped = userSkipped.has(globalIdx)}
										<tr
											class="border-b border-border transition-colors
												{dupe ? 'bg-warning/5 opacity-50' : skipped ? 'opacity-40' : 'hover:bg-bg-hover'}"
										>
											<td class="px-3 py-2 text-center">
												{#if !dupe}
													<input
														type="checkbox"
														checked={!skipped}
														onchange={() => toggleSkip(globalIdx)}
														class="rounded text-accent"
													/>
												{/if}
											</td>
											<td class="px-3 py-2 text-text-secondary">
												{formatDate(tx.date)}
											</td>
											<td class="px-3 py-2">
												<p class="text-text-primary">{tx.label}</p>
												{#if tx.note}
													<p class="text-xs text-text-muted">{tx.note}</p>
												{/if}
											</td>
											<td
												class="px-3 py-2 text-right font-medium {tx.amount >= 0
													? 'text-income'
													: 'text-expense'}"
											>
												{confidentialStore.format(tx.amount)}
											</td>
											<td class="px-3 py-2 text-center">
												{#if dupe}
													<span
														class="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning"
													>
														Doublon
													</span>
												{:else if skipped}
													<span class="text-xs text-text-muted">Ignoré</span>
												{:else}
													<span
														class="inline-flex items-center gap-1 rounded-full bg-income/10 px-2 py-0.5 text-xs text-income"
													>
														Nouveau
													</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Pagination -->
						{#if totalPages() > 1}
							<div class="flex items-center justify-center gap-4">
								<button
									onclick={() => (previewPage = Math.max(0, previewPage - 1))}
									disabled={previewPage === 0}
									class="rounded p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
								>
									<ChevronLeft size={16} />
								</button>
								<span class="text-sm text-text-secondary">
									Page {previewPage + 1} / {totalPages()}
								</span>
								<button
									onclick={() =>
										(previewPage = Math.min(totalPages() - 1, previewPage + 1))}
									disabled={previewPage >= totalPages() - 1}
									class="rounded p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
								>
									<ChevronRight size={16} />
								</button>
							</div>
						{/if}

						<!-- Actions -->
						<div class="flex justify-between pt-2">
							<button
								onclick={() => (step = 'pick')}
								class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
							>
								Changer de fichier
							</button>
							<div class="flex gap-3">
								<button
									onclick={onclose}
									class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
								>
									Annuler
								</button>
								<button
									onclick={confirmImport}
									disabled={newTransactionCount() === 0}
									class="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
								>
									Importer {newTransactionCount()} transaction{newTransactionCount() > 1 ? 's' : ''}
								</button>
							</div>
						</div>
					</div>
				{/if}

			{:else if step === 'importing'}
				<div class="flex flex-col items-center justify-center py-12">
					<div class="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
					<p class="text-text-secondary">Import en cours...</p>
				</div>

			{:else if step === 'done'}
				{#if result}
					<div class="flex flex-col items-center justify-center py-12">
						<div class="mb-4 rounded-full bg-income/10 p-4">
							<Check size={32} class="text-income" />
						</div>
						<p class="mb-2 text-lg font-medium text-text-primary">Import réussi !</p>
						<p class="mb-1 text-sm text-text-secondary">
							{result.imported_count} transaction{result.imported_count > 1 ? 's' : ''} importée{result.imported_count > 1 ? 's' : ''}
						</p>
						{#if result.duplicates_skipped > 0}
							<p class="mb-4 text-sm text-text-muted">
								{result.duplicates_skipped} doublon{result.duplicates_skipped > 1 ? 's' : ''} ignoré{result.duplicates_skipped > 1 ? 's' : ''}
							</p>
						{/if}
						<button
							onclick={finish}
							class="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-hover"
						>
							Fermer
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
