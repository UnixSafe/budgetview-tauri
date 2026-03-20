<script lang="ts">
	import { X, Plus, Trash2 } from 'lucide-svelte';
	import { splitStore } from '$lib/stores/splits.svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { formatCurrency, toEuros, toCents } from '$lib/utils/format';
	import { confidentialStore } from '$lib/stores/confidential.svelte';
	import type { Transaction } from '$lib/types';
	import { onMount } from 'svelte';

	interface Props {
		transaction: Transaction;
		onclose: () => void;
	}

	let { transaction, onclose }: Props = $props();

	let lines = $state<{ amount: number; seriesId: number; subSeriesId: number | null; note: string }[]>([]);

	// Initialize lines on first render
	$effect(() => {
		if (lines.length === 0) {
			lines = [{ amount: toEuros(Math.abs(transaction.amount)), seriesId: 0, subSeriesId: null, note: '' }];
		}
	});

	let saving = $state(false);
	let loadingExisting = $state(true);

	let isExpense = $derived(transaction.amount < 0);
	let totalCents = $derived(Math.abs(transaction.amount));
	let totalEuros = $derived(toEuros(totalCents));

	let allocatedCents = $derived(
		lines.reduce((sum, l) => sum + toCents(Math.abs(l.amount) || 0), 0)
	);
	let remainingCents = $derived(totalCents - allocatedCents);
	let isValid = $derived(remainingCents === 0 && lines.every((l) => l.seriesId > 0 && l.amount > 0));

	function addLine() {
		const remaining = toEuros(Math.max(0, remainingCents));
		lines.push({ amount: remaining, seriesId: 0, subSeriesId: null, note: '' });
	}

	function removeLine(index: number) {
		if (lines.length <= 1) return;
		lines.splice(index, 1);
	}

	async function handleSave() {
		if (!isValid) return;
		saving = true;
		try {
			const splits = lines.map((l) => ({
				amount_cents: isExpense ? -toCents(Math.abs(l.amount)) : toCents(Math.abs(l.amount)),
				series_id: l.seriesId,
				sub_series_id: l.subSeriesId,
				note: l.note.trim() || null
			}));
			await splitStore.create(transaction.id, splits);
			toastStore.success('Ventilation enregistrée');
			onclose();
		} catch (e) {
			toastStore.error(String(e));
		} finally {
			saving = false;
		}
	}

	async function handleRemoveSplits() {
		if (!confirm('Supprimer la ventilation ?')) return;
		try {
			await splitStore.remove(transaction.id);
			toastStore.success('Ventilation supprimée');
			onclose();
		} catch (e) {
			toastStore.error(String(e));
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	onMount(async () => {
		await splitStore.load(transaction.id);
		if (splitStore.splits.length > 0) {
			lines = splitStore.splits.map((s) => ({
				amount: toEuros(Math.abs(s.amount)),
				seriesId: s.series_id,
				subSeriesId: s.sub_series_id,
				note: s.note ?? ''
			}));
		}
		loadingExisting = false;
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in" role="dialog" aria-label="Ventiler la transaction">
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="absolute inset-0" onclick={onclose}></div>
	<div class="relative w-full max-w-lg glass-card p-7 shadow-2xl animate-modal-in mx-4">
		<div class="mb-6 flex items-center justify-between">
			<h2 class="text-xl font-bold tracking-tight text-text-primary">Ventiler la transaction</h2>
			<button onclick={onclose} class="rounded-xl p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth" aria-label="Fermer">
				<X size={18} />
			</button>
		</div>

		<!-- Transaction info -->
		<div class="mb-6 rounded-2xl bg-bg-primary/40 p-4">
			<p class="text-[14px] font-medium text-text-primary">{transaction.label}</p>
			<p class="mt-1 text-lg font-bold tabular-nums {transaction.amount >= 0 ? 'text-income' : 'text-expense'}">
				{confidentialStore.format(transaction.amount)}
			</p>
		</div>

		{#if loadingExisting}
			<div class="flex items-center gap-3 py-8 justify-center">
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-accent/20 border-t-accent"></div>
				<span class="text-[13px] text-text-muted">Chargement...</span>
			</div>
		{:else}
			<!-- Split lines -->
			<div class="mb-5 space-y-4 max-h-64 overflow-y-auto scrollbar-hide">
				{#each lines as line, i}
					<div class="rounded-xl bg-bg-primary/30 p-4">
						<div class="flex items-start gap-3">
							<div class="flex-1 grid grid-cols-[1fr_1.5fr] gap-3">
								<div>
									<label for="split-amount-{i}" class="mb-1 block text-[11px] font-semibold text-text-muted uppercase tracking-wider">Montant</label>
									<input id="split-amount-{i}" type="number" step="0.01" min="0.01" bind:value={line.amount}
										class="w-full rounded-xl border border-border bg-bg-primary/60 px-3 py-2.5 text-[14px] text-text-primary outline-none focus-ring" />
								</div>
								<div>
									<label for="split-series-{i}" class="mb-1 block text-[11px] font-semibold text-text-muted uppercase tracking-wider">Catégorie</label>
									<select id="split-series-{i}" bind:value={line.seriesId}
										class="w-full rounded-xl border border-border bg-bg-primary/60 px-3 py-2.5 text-[14px] text-text-primary outline-none focus-ring">
										<option value={0}>Choisir...</option>
										{#each budgetStore.series as series}
											<option value={series.id}>{series.name}</option>
										{/each}
									</select>
								</div>
							</div>
							<div class="pt-6">
								<button onclick={() => removeLine(i)} disabled={lines.length <= 1}
									class="rounded-xl p-2 text-text-muted hover:text-danger hover:bg-danger/10 transition-smooth disabled:opacity-20"
									aria-label="Supprimer la ligne {i + 1}">
									<Trash2 size={14} />
								</button>
							</div>
						</div>
						<div class="mt-2">
							<label for="split-note-{i}" class="sr-only">Note</label>
							<input id="split-note-{i}" placeholder="Note (optionnel)" bind:value={line.note}
								class="w-full rounded-lg border border-border-light bg-bg-primary/40 px-3 py-2 text-[12px] text-text-secondary outline-none focus-ring placeholder:text-text-muted" />
						</div>
					</div>
				{/each}
			</div>

			<button onclick={addLine}
				class="mb-5 flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-hover transition-smooth">
				<Plus size={14} />Ajouter une ligne
			</button>

			<!-- Remaining -->
			<div class="mb-5 flex items-center justify-between rounded-2xl bg-bg-primary/40 px-5 py-3">
				<span class="text-[13px] text-text-secondary">Reste à ventiler</span>
				<span class="text-[14px] font-bold tabular-nums {remainingCents === 0 ? 'text-income' : remainingCents < 0 ? 'text-expense' : 'text-text-primary'}">
					{confidentialStore.format(remainingCents)}
				</span>
			</div>

			<!-- Actions -->
			<div class="flex items-center justify-between">
				<div>
					{#if splitStore.splits.length > 0}
						<button onclick={handleRemoveSplits}
							class="text-[13px] font-medium text-danger hover:text-danger/80 transition-smooth">
							Supprimer la ventilation
						</button>
					{/if}
				</div>
				<div class="flex gap-3">
					<button onclick={onclose} class="rounded-xl px-5 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-smooth">
						Annuler
					</button>
					<button onclick={handleSave} disabled={!isValid || saving}
						class="rounded-xl bg-accent px-6 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20 disabled:opacity-40">
						{saving ? 'Enregistrement...' : 'Sauvegarder'}
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
