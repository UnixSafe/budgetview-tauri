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
		weekly: 'Hebdomadaire', biweekly: 'Bimensuel', monthly: 'Mensuel',
		quarterly: 'Trimestriel', biannual: 'Semestriel', yearly: 'Annuel'
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
		await Promise.all([recurringStore.load(), recurringStore.checkMissing(), accountStore.load(), budgetStore.loadSeries()]);
	});

	async function handleDetect() {
		await recurringStore.detect();
		if (recurringStore.patterns.length === 0) { toastStore.show('Aucune nouvelle récurrence détectée'); }
		else { toastStore.success(`${recurringStore.patterns.length} récurrence(s) détectée(s)`); }
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
		editingId = null; formLabel = ''; formAmount = 0;
		formAccountId = accountStore.accounts[0]?.id ?? 0;
		formSeriesId = ''; formFrequency = 'monthly'; formDayOfMonth = 1;
		showForm = true;
	}

	function openEdit(item: RecurringTransaction) {
		editingId = item.id; formLabel = item.label; formAmount = item.amount / 100;
		formAccountId = item.account_id; formSeriesId = item.series_id ?? '';
		formFrequency = item.frequency ?? 'monthly'; formDayOfMonth = item.day_of_month ?? 1;
		showForm = true;
	}

	async function handleSubmit() {
		if (!formLabel.trim() || !formAccountId) return;
		const seriesId = formSeriesId === '' ? null : Number(formSeriesId);
		if (editingId) {
			await recurringStore.update(editingId, { label: formLabel, amount: toCents(formAmount), seriesId: seriesId ?? undefined, frequency: formFrequency, dayOfMonth: formDayOfMonth });
			toastStore.success('Récurrence modifiée');
		} else {
			await invoke('create_recurring', { label: formLabel, labelPattern: formLabel.toUpperCase(), accountId: formAccountId, amount: toCents(formAmount), seriesId, frequency: formFrequency, dayOfMonth: formDayOfMonth });
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

<div class="space-y-8 animate-fade-in">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-headline text-text-primary">Récurrences</h1>
			<p class="mt-1.5 text-body text-text-muted">Gérez vos opérations régulières</p>
		</div>
		<div class="flex gap-3">
			<button onclick={handleDetect} disabled={recurringStore.detecting} class="btn-secondary disabled:opacity-40">
				<Zap size={16} />
				{recurringStore.detecting ? 'Analyse...' : 'Détecter'}
			</button>
			<button onclick={openCreate} class="btn-primary">
				<Plus size={16} strokeWidth={2.5} />
				Ajouter
			</button>
		</div>
	</div>

	{#if recurringStore.error}
		<ErrorBanner message={recurringStore.error} ondismiss={() => (recurringStore.error = null)} />
	{/if}

	<!-- Missing alerts -->
	{#if recurringStore.missing.length > 0}
		<div class="space-y-3 animate-slide-up">
			<div class="glass-card p-6" style="border-color: rgba(255, 214, 10, 0.15);">
				<h2 class="flex items-center gap-2.5 text-caption font-semibold text-warning uppercase tracking-wider mb-4">
					<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/15">
						<AlertTriangle size={14} class="text-warning" />
					</div>
					En retard ({recurringStore.missing.length})
				</h2>
				<div class="space-y-2 stagger-children">
					{#each recurringStore.missing as alert}
						<div class="flex items-center justify-between rounded-2xl bg-bg-primary/30 px-5 py-4 transition-smooth hover:bg-bg-hover/50">
							<div>
								<p class="text-[14px] font-semibold text-text-primary tracking-tight">{alert.label}</p>
								<p class="text-caption text-text-muted mt-1">
									Attendue le {formatDate(alert.expected_date)} &middot; {alert.days_overdue}j de retard
									{#if alert.account_name} &middot; {alert.account_name}{/if}
								</p>
							</div>
							<span class="text-[15px] font-bold tabular-nums {alert.amount >= 0 ? 'text-income' : 'text-expense'}">
								{formatCurrency(alert.amount)}
							</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Detected patterns -->
	{#if recurringStore.patterns.length > 0}
		<div class="space-y-3 animate-slide-up">
			<div class="glass-card p-6" style="border-color: rgba(10, 132, 255, 0.15);">
				<h2 class="flex items-center gap-2.5 text-caption font-semibold text-accent uppercase tracking-wider mb-4">
					<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15">
						<Zap size={14} class="text-accent" />
					</div>
					Récurrences détectées
				</h2>
				<div class="space-y-2 stagger-children">
					{#each recurringStore.patterns as pattern, i}
						<div class="flex items-center justify-between rounded-2xl bg-bg-primary/30 px-5 py-4 transition-smooth hover:bg-bg-hover/50">
							<div>
								<p class="text-[14px] font-semibold text-text-primary tracking-tight">{pattern.label}</p>
								<p class="text-caption text-text-muted mt-1">
									{pattern.account_name} &middot; {FREQ_LABELS[pattern.frequency] ?? pattern.frequency}
									&middot; ~{formatCurrency(pattern.avg_amount)} &middot; {pattern.transaction_count} occ.
									{#if pattern.series_name} &middot; {pattern.series_name}{/if}
								</p>
							</div>
							<div class="flex gap-2">
								<button onclick={() => handleConfirmPattern(i)} class="btn-primary !px-4 !py-2 !text-[13px] !rounded-xl">
									<Check size={14} />Confirmer
								</button>
								<button onclick={() => dismissPattern(i)}
									class="flex items-center justify-center rounded-xl border border-border w-9 h-9 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
									<X size={14} />
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- List -->
	{#if recurringStore.loading}
		<LoadingSpinner message="Chargement..." />
	{:else if recurringStore.items.length === 0 && recurringStore.patterns.length === 0}
		<div class="flex flex-col items-center justify-center glass-card p-20 stagger-children">
			<div class="mb-6 flex h-24 w-24 items-center justify-center rounded-[28px] bg-bg-elevated/60">
				<RefreshCw size={40} class="text-text-muted" strokeWidth={1.3} />
			</div>
			<p class="text-title text-text-primary">Aucune récurrence</p>
			<p class="mt-2 text-body text-text-muted max-w-xs text-center">Cliquez sur "Détecter" pour analyser vos transactions ou ajoutez-en manuellement</p>
			<button onclick={openCreate} class="btn-primary mt-8">
				<Plus size={16} strokeWidth={2.5} />
				Ajouter une récurrence
			</button>
		</div>
	{:else if recurringStore.items.length > 0}
		<div class="glass-card overflow-hidden animate-slide-up">
			<table class="w-full">
				<thead>
					<tr class="border-b border-border-light">
						<th class="px-6 py-4 text-left text-caption font-semibold text-text-muted uppercase tracking-wider">Libellé</th>
						<th class="px-6 py-4 text-left text-caption font-semibold text-text-muted uppercase tracking-wider">Compte</th>
						<th class="px-6 py-4 text-left text-caption font-semibold text-text-muted uppercase tracking-wider">Fréquence</th>
						<th class="px-6 py-4 text-left text-caption font-semibold text-text-muted uppercase tracking-wider">Catégorie</th>
						<th class="px-6 py-4 text-left text-caption font-semibold text-text-muted uppercase tracking-wider">Prochaine</th>
						<th class="px-6 py-4 text-right text-caption font-semibold text-text-muted uppercase tracking-wider">Montant</th>
						<th class="px-6 py-4 w-32"></th>
					</tr>
				</thead>
				<tbody>
					{#each recurringStore.items as item (item.id)}
						<tr class="border-b border-border-light/50 hover-row" class:opacity-40={!item.is_active}>
							<td class="px-6 py-4">
								<p class="text-[14px] font-medium text-text-primary tracking-tight">{item.label}</p>
								{#if item.day_of_month}
									<p class="text-caption text-text-muted mt-0.5">Le {item.day_of_month} du mois</p>
								{/if}
							</td>
							<td class="px-6 py-4 text-[13px] text-text-secondary">{item.account_name ?? ''}</td>
							<td class="px-6 py-4">
								<span class="badge bg-bg-elevated text-text-secondary">{FREQ_LABELS[item.frequency ?? ''] ?? '—'}</span>
							</td>
							<td class="px-6 py-4 text-[13px] text-text-secondary">{item.series_name ?? '—'}</td>
							<td class="px-6 py-4 text-[13px] text-text-secondary tabular-nums">
								{item.next_expected_date ? formatDate(item.next_expected_date) : '—'}
							</td>
							<td class="px-6 py-4 text-right text-[15px] font-bold tabular-nums {item.amount >= 0 ? 'text-income' : 'text-expense'}">
								{formatCurrency(item.amount)}
							</td>
							<td class="px-6 py-4">
								<div class="flex gap-1 justify-end">
									<button onclick={() => openEdit(item)} class="rounded-xl p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
										<Pencil size={14} />
									</button>
									<button onclick={() => handleToggleActive(item)} class="rounded-xl p-2 text-text-muted hover:text-warning hover:bg-warning/10 transition-smooth" title={item.is_active ? 'Désactiver' : 'Réactiver'}>
										{#if item.is_active}<X size={14} />{:else}<Check size={14} />{/if}
									</button>
									<button onclick={() => handleRemove(item.id)} class="rounded-xl p-2 text-text-muted hover:text-danger hover:bg-danger/10 transition-smooth">
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

<!-- Modal -->
{#if showForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={() => (showForm = false)}></div>
		<div class="relative w-full max-w-lg glass-card p-8 shadow-2xl animate-modal-in mx-4">
			<div class="mb-7 flex items-center justify-between">
				<h2 class="text-title text-text-primary">{editingId ? 'Modifier la récurrence' : 'Nouvelle récurrence'}</h2>
				<button onclick={() => (showForm = false)} class="rounded-xl p-2.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
					<X size={18} />
				</button>
			</div>
			<form onsubmit={handleSubmit} class="space-y-5">
				<div>
					<label for="rec-label" class="mb-2 block text-caption font-medium text-text-secondary">Libellé *</label>
					<input id="rec-label" bind:value={formLabel} required placeholder="Ex: Loyer, Netflix..."
						class="w-full rounded-2xl border border-border bg-bg-input px-4 py-3.5 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="rec-amount" class="mb-2 block text-caption font-medium text-text-secondary">Montant *</label>
						<input id="rec-amount" type="number" step="0.01" bind:value={formAmount} required
							class="w-full rounded-2xl border border-border bg-bg-input px-4 py-3.5 text-[14px] text-text-primary outline-none focus-ring" />
					</div>
					<div>
						<label for="rec-account" class="mb-2 block text-caption font-medium text-text-secondary">Compte *</label>
						<select id="rec-account" bind:value={formAccountId} required disabled={!!editingId}
							class="w-full rounded-2xl border border-border bg-bg-input px-4 py-3.5 text-[14px] text-text-primary outline-none focus-ring disabled:opacity-40">
							{#each accountStore.accounts as account}
								<option value={account.id}>{account.name}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="rec-freq" class="mb-2 block text-caption font-medium text-text-secondary">Fréquence</label>
						<select id="rec-freq" bind:value={formFrequency}
							class="w-full rounded-2xl border border-border bg-bg-input px-4 py-3.5 text-[14px] text-text-primary outline-none focus-ring">
							{#each Object.entries(FREQ_LABELS) as [value, label]}
								<option {value}>{label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="rec-day" class="mb-2 block text-caption font-medium text-text-secondary">Jour du mois</label>
						<input id="rec-day" type="number" min="1" max="31" bind:value={formDayOfMonth}
							class="w-full rounded-2xl border border-border bg-bg-input px-4 py-3.5 text-[14px] text-text-primary outline-none focus-ring" />
					</div>
				</div>
				<div>
					<label for="rec-series" class="mb-2 block text-caption font-medium text-text-secondary">Catégorie</label>
					<select id="rec-series" bind:value={formSeriesId}
						class="w-full rounded-2xl border border-border bg-bg-input px-4 py-3.5 text-[14px] text-text-primary outline-none focus-ring">
						<option value="">Aucune</option>
						{#each budgetStore.series as series}
							<option value={series.id}>{series.name}</option>
						{/each}
					</select>
				</div>
				<div class="divider"></div>
				<div class="flex justify-end gap-3 pt-1">
					<button type="button" onclick={() => (showForm = false)} class="btn-secondary !py-2.5">
						Annuler
					</button>
					<button type="submit" class="btn-primary !py-2.5">
						{editingId ? 'Enregistrer' : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
