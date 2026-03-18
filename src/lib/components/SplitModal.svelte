<script lang="ts">
	import { X, Plus, Trash2 } from 'lucide-svelte';
	import { splitStore } from '$lib/stores/splits.svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { formatCurrency, toEuros, toCents } from '$lib/utils/format';
	import type { Transaction } from '$lib/types';

	interface Props {
		transaction: Transaction;
		onclose: () => void;
	}

	let { transaction, onclose }: Props = $props();

	let lines = $state<{ amount: number; seriesId: number | string; note: string }[]>([
		{ amount: toEuros(Math.abs(transaction.amount)), seriesId: '', note: '' }
	]);

	let saving = $state(false);

	// Amount is stored in cents, could be negative (expense) or positive (income)
	let isExpense = transaction.amount < 0;
	let totalCents = Math.abs(transaction.amount);
	let totalEuros = toEuros(totalCents);

	let allocatedCents = $derived(
		lines.reduce((sum, l) => sum + toCents(Math.abs(l.amount) || 0), 0)
	);
	let remainingCents = $derived(totalCents - allocatedCents);
	let isValid = $derived(remainingCents === 0 && lines.every((l) => l.seriesId !== '' && l.amount > 0));

	function addLine() {
		const remaining = toEuros(Math.max(0, remainingCents));
		lines.push({ amount: remaining, seriesId: '', note: '' });
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
				series_id: Number(l.seriesId),
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
		if (!confirm('Supprimer la ventilation de cette transaction ?')) return;
		try {
			await splitStore.remove(transaction.id);
			toastStore.success('Ventilation supprimée');
			onclose();
		} catch (e) {
			toastStore.error(String(e));
		}
	}

	// Load existing splits on mount
	async function loadExisting() {
		await splitStore.load(transaction.id);
		if (splitStore.splits.length > 0) {
			lines = splitStore.splits.map((s) => ({
				amount: toEuros(Math.abs(s.amount)),
				seriesId: s.series_id,
				note: s.note ?? ''
			}));
		}
	}
	loadExisting();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="absolute inset-0" onclick={onclose}></div>
	<div class="relative w-full max-w-lg rounded-xl border border-border bg-bg-secondary p-6 shadow-xl">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-text-primary">Ventiler la transaction</h2>
			<button onclick={onclose} class="text-text-muted hover:text-text-primary">
				<X size={20} />
			</button>
		</div>

		<!-- Transaction info -->
		<div class="mb-4 rounded-lg border border-border bg-bg-primary p-3">
			<p class="text-sm font-medium text-text-primary">{transaction.label}</p>
			<p class="text-sm font-semibold {transaction.amount >= 0 ? 'text-income' : 'text-expense'}">
				{formatCurrency(transaction.amount)}
			</p>
		</div>

		<!-- Split lines -->
		<div class="mb-4 space-y-3 max-h-64 overflow-y-auto">
			{#each lines as line, i}
				<div class="flex items-start gap-2">
					<div class="flex-1 grid grid-cols-[1fr_1.5fr] gap-2">
						<div>
							<label for="split-amount-{i}" class="mb-1 block text-xs text-text-muted">Montant</label>
							<input
								id="split-amount-{i}"
								type="number"
								step="0.01"
								min="0.01"
								bind:value={line.amount}
								class="w-full rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
							/>
						</div>
						<div>
							<label for="split-series-{i}" class="mb-1 block text-xs text-text-muted">Catégorie</label>
							<select
								id="split-series-{i}"
								bind:value={line.seriesId}
								class="w-full rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
							>
								<option value="">Choisir...</option>
								{#each budgetStore.series as series}
									<option value={series.id}>{series.name}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="flex-shrink-0 pt-5">
						<button
							onclick={() => removeLine(i)}
							disabled={lines.length <= 1}
							class="rounded p-1 text-text-muted hover:text-danger disabled:opacity-30"
						>
							<Trash2 size={14} />
						</button>
					</div>
				</div>
				<div class="pl-0">
					<input
						placeholder="Note (optionnel)"
						bind:value={line.note}
						class="w-full rounded-lg border border-border bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent"
					/>
				</div>
			{/each}
		</div>

		<!-- Add line button -->
		<button
			onclick={addLine}
			class="mb-4 flex items-center gap-1 text-sm text-accent hover:text-accent-hover"
		>
			<Plus size={14} />
			Ajouter une ligne
		</button>

		<!-- Remaining display -->
		<div class="mb-4 flex items-center justify-between rounded-lg border border-border bg-bg-primary px-3 py-2">
			<span class="text-sm text-text-secondary">Reste à ventiler</span>
			<span
				class="text-sm font-semibold {remainingCents === 0 ? 'text-income' : remainingCents < 0 ? 'text-expense' : 'text-text-primary'}"
			>
				{formatCurrency(remainingCents)}
			</span>
		</div>

		<!-- Actions -->
		<div class="flex items-center justify-between">
			<div>
				{#if splitStore.splits.length > 0}
					<button
						onclick={handleRemoveSplits}
						class="text-sm text-danger hover:underline"
					>
						Supprimer la ventilation
					</button>
				{/if}
			</div>
			<div class="flex gap-3">
				<button
					onclick={onclose}
					class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
				>
					Annuler
				</button>
				<button
					onclick={handleSave}
					disabled={!isValid || saving}
					class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
				>
					{saving ? 'Enregistrement...' : 'Sauvegarder'}
				</button>
			</div>
		</div>
	</div>
</div>
