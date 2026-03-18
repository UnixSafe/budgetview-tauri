<script lang="ts">
	import { onMount } from 'svelte';
	import { RefreshCw, Plus, Trash2, Check, X, Zap, AlertTriangle, Pencil } from 'lucide-svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { recurringStore } from '$lib/stores/recurring.svelte';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { formatCurrency, formatDate, toCents } from '$lib/utils/format';
	import type { RecurringTransaction } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';

	const FREQ_LABELS: Record<string, string> = {
		weekly: 'Hebdomadaire',
		biweekly: 'Bimensuel',
		monthly: 'Mensuel',
		quarterly: 'Trimestriel',
		biannual: 'Semestriel',
		yearly: 'Annuel'
	};

	let showForm = $state(false);
	let editingId = $state<number | null>(null);
	let formLabel = $state('');
	let formAmount = $state(0);
	let formAccountId = $state<number>(0);
	let formSeriesId = $state<number | string>('');
	let formFrequency = $state('monthly');
	let formDayOfMonth = $state<number>(1);

	onMount(async () => {
		await Promise.all([
			recurringStore.load(),
			recurringStore.checkMissing(),
			accountStore.load(),
			budgetStore.loadSeries()
		]);
	});

	async function handleDetect() {
		await recurringStore.detect();
		if (recurringStore.patterns.length === 0) {
			toastStore.show('Aucune nouvelle récurrence détectée');
		} else {
			toastStore.success(`${recurringStore.patterns.length} récurrence(s) détectée(s)`);
		}
	}

	async function handleConfirmPattern(index: number) {
		const pattern = recurringStore.patterns[index];
		await recurringStore.confirmPattern(pattern);
		toastStore.success(`Récurrence "${pattern.label}" confirmée`);
		await recurringStore.checkMissing();
	}

	function dismissPattern(index: number) {
		recurringStore.patterns = recurringStore.patterns.filter((_, i) => i !== index);
	}

	function openCreate() {
		editingId = null;
		formLabel = '';
		formAmount = 0;
		formAccountId = accountStore.accounts[0]?.id ?? 0;
		formSeriesId = '';
		formFrequency = 'monthly';
		formDayOfMonth = 1;
		showForm = true;
	}

	function openEdit(item: RecurringTransaction) {
		editingId = item.id;
		formLabel = item.label;
		formAmount = item.amount / 100;
		formAccountId = item.account_id;
		formSeriesId = item.series_id ?? '';
		formFrequency = item.frequency ?? 'monthly';
		formDayOfMonth = item.day_of_month ?? 1;
		showForm = true;
	}

	async function handleSubmit() {
		if (!formLabel.trim() || !formAccountId) return;
		const seriesId = formSeriesId === '' ? null : Number(formSeriesId);

		if (editingId) {
			await recurringStore.update(editingId, {
				label: formLabel,
				amount: toCents(formAmount),
				seriesId: seriesId ?? undefined,
				frequency: formFrequency,
				dayOfMonth: formDayOfMonth
			});
			toastStore.success('Récurrence modifiée');
		} else {
			await invoke('create_recurring', {
				label: formLabel,
				labelPattern: formLabel.toUpperCase(),
				accountId: formAccountId,
				amount: toCents(formAmount),
				seriesId: seriesId,
				frequency: formFrequency,
				dayOfMonth: formDayOfMonth
			});
			await recurringStore.load();
			toastStore.success('Récurrence créée');
		}
		showForm = false;
		await recurringStore.checkMissing();
	}

	async function handleRemove(id: number) {
		if (!confirm('Supprimer cette récurrence ?')) return;
		await recurringStore.remove(id);
		toastStore.success('Récurrence supprimée');
	}

	async function handleToggleActive(item: RecurringTransaction) {
		await recurringStore.update(item.id, { isActive: !item.is_active });
		await recurringStore.checkMissing();
	}
</script>

<svelte:head>
	<title>Récurrences — BudgetView</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-text-primary">Récurrences</h1>
		<div class="flex gap-2">
			<button
				onclick={handleDetect}
				disabled={recurringStore.detecting}
				class="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-50"
			>
				<Zap size={16} />
				{recurringStore.detecting ? 'Analyse...' : 'Détecter'}
			</button>
			<button
				onclick={openCreate}
				class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
			>
				<Plus size={16} />
				Ajouter
			</button>
		</div>
	</div>

	{#if recurringStore.error}
		<ErrorBanner message={recurringStore.error} ondismiss={() => (recurringStore.error = null)} />
	{/if}

	<!-- Missing recurrence alerts -->
	{#if recurringStore.missing.length > 0}
		<div class="space-y-2">
			<h2 class="flex items-center gap-2 text-sm font-semibold text-warning">
				<AlertTriangle size={16} />
				Récurrences en retard
			</h2>
			{#each recurringStore.missing as alert}
				<div class="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/5 p-4">
					<div>
						<p class="text-sm font-medium text-text-primary">{alert.label}</p>
						<p class="text-xs text-text-muted">
							Attendue le {formatDate(alert.expected_date)} · {alert.days_overdue} jours de retard
							{#if alert.account_name} · {alert.account_name}{/if}
							{#if alert.series_name} · {alert.series_name}{/if}
						</p>
					</div>
					<span class="text-sm font-medium {alert.amount >= 0 ? 'text-income' : 'text-expense'}">
						{formatCurrency(alert.amount)}
					</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Detected patterns -->
	{#if recurringStore.patterns.length > 0}
		<div class="space-y-2">
			<h2 class="text-sm font-semibold text-text-secondary">Récurrences détectées</h2>
			{#each recurringStore.patterns as pattern, i}
				<div class="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 p-4">
					<div>
						<p class="text-sm font-medium text-text-primary">{pattern.label}</p>
						<p class="text-xs text-text-muted">
							{pattern.account_name} · {FREQ_LABELS[pattern.frequency] ?? pattern.frequency}
							· ~{formatCurrency(pattern.avg_amount)} · {pattern.transaction_count} occurrences
							· jour ~{pattern.day_of_month}
							{#if pattern.series_name} · {pattern.series_name}{/if}
						</p>
					</div>
					<div class="flex gap-2">
						<button
							onclick={() => handleConfirmPattern(i)}
							class="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
						>
							<Check size={14} />
							Confirmer
						</button>
						<button
							onclick={() => dismissPattern(i)}
							class="rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
						>
							<X size={14} />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Existing recurring transactions -->
	{#if recurringStore.loading}
		<LoadingSpinner message="Chargement des récurrences..." />
	{:else if recurringStore.items.length === 0 && recurringStore.patterns.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-12">
			<RefreshCw size={48} class="mb-4 text-text-muted" />
			<p class="text-lg font-medium text-text-secondary">Aucune récurrence</p>
			<p class="text-sm text-text-muted">Cliquez sur "Détecter" pour analyser vos transactions</p>
		</div>
	{:else if recurringStore.items.length > 0}
		<div class="overflow-hidden rounded-xl border border-border">
			<table class="w-full">
				<thead>
					<tr class="border-b border-border bg-bg-secondary text-left text-sm text-text-secondary">
						<th class="px-4 py-3 font-medium">Libellé</th>
						<th class="px-4 py-3 font-medium">Compte</th>
						<th class="px-4 py-3 font-medium">Fréquence</th>
						<th class="px-4 py-3 font-medium">Catégorie</th>
						<th class="px-4 py-3 font-medium">Prochaine</th>
						<th class="px-4 py-3 text-right font-medium">Montant</th>
						<th class="px-4 py-3 w-24"></th>
					</tr>
				</thead>
				<tbody>
					{#each recurringStore.items as item (item.id)}
						<tr class="border-b border-border transition-colors hover:bg-bg-hover" class:opacity-50={!item.is_active}>
							<td class="px-4 py-3">
								<p class="text-sm font-medium text-text-primary">{item.label}</p>
								{#if item.day_of_month}
									<p class="text-xs text-text-muted">Le {item.day_of_month} du mois</p>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-text-secondary">{item.account_name ?? ''}</td>
							<td class="px-4 py-3 text-sm text-text-secondary">{FREQ_LABELS[item.frequency ?? ''] ?? item.frequency ?? '—'}</td>
							<td class="px-4 py-3 text-sm text-text-secondary">{item.series_name ?? 'Non catégorisée'}</td>
							<td class="px-4 py-3 text-sm text-text-secondary">
								{#if item.next_expected_date}
									{formatDate(item.next_expected_date)}
								{:else}
									—
								{/if}
							</td>
							<td class="px-4 py-3 text-right text-sm font-medium {item.amount >= 0 ? 'text-income' : 'text-expense'}">
								{formatCurrency(item.amount)}
							</td>
							<td class="px-4 py-3">
								<div class="flex gap-1">
									<button onclick={() => openEdit(item)} class="rounded p-1 text-text-muted hover:text-text-primary" title="Modifier">
										<Pencil size={14} />
									</button>
									<button onclick={() => handleToggleActive(item)} class="rounded p-1 text-text-muted hover:text-warning" title={item.is_active ? 'Désactiver' : 'Réactiver'}>
										{#if item.is_active}<X size={14} />{:else}<Check size={14} />{/if}
									</button>
									<button onclick={() => handleRemove(item.id)} class="rounded p-1 text-text-muted hover:text-danger" title="Supprimer">
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
</div>

<!-- Modal création/édition -->
{#if showForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={() => (showForm = false)}></div>
		<div class="relative w-full max-w-md rounded-xl border border-border bg-bg-secondary p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-text-primary">
					{editingId ? 'Modifier la récurrence' : 'Nouvelle récurrence'}
				</h2>
				<button onclick={() => (showForm = false)} class="text-text-muted hover:text-text-primary">
					<X size={20} />
				</button>
			</div>

			<form onsubmit={handleSubmit} class="space-y-4">
				<div>
					<label for="rec-label" class="mb-1 block text-sm font-medium text-text-secondary">Libellé *</label>
					<input id="rec-label" bind:value={formLabel} required
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="rec-amount" class="mb-1 block text-sm font-medium text-text-secondary">Montant *</label>
						<input id="rec-amount" type="number" step="0.01" bind:value={formAmount} required
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
					</div>
					<div>
						<label for="rec-account" class="mb-1 block text-sm font-medium text-text-secondary">Compte *</label>
						<select id="rec-account" bind:value={formAccountId} required disabled={!!editingId}
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent disabled:opacity-50">
							{#each accountStore.accounts as account}
								<option value={account.id}>{account.name}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="rec-freq" class="mb-1 block text-sm font-medium text-text-secondary">Fréquence</label>
						<select id="rec-freq" bind:value={formFrequency}
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent">
							{#each Object.entries(FREQ_LABELS) as [value, label]}
								<option {value}>{label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="rec-day" class="mb-1 block text-sm font-medium text-text-secondary">Jour du mois</label>
						<input id="rec-day" type="number" min="1" max="31" bind:value={formDayOfMonth}
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
					</div>
				</div>
				<div>
					<label for="rec-series" class="mb-1 block text-sm font-medium text-text-secondary">Catégorie</label>
					<select id="rec-series" bind:value={formSeriesId}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent">
						<option value="">Aucune</option>
						{#each budgetStore.series as series}
							<option value={series.id}>{series.name}</option>
						{/each}
					</select>
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
