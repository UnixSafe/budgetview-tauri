<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { formatCurrency, formatMonth, toEuros, BUDGET_AREA_LABELS } from '$lib/utils/format';
	import type { BudgetArea, BudgetLineItem } from '$lib/types';

	let showSeriesForm = $state(false);
	let editingSeriesId = $state<number | null>(null);
	let formName = $state('');
	let formArea = $state<BudgetArea>('variable');
	let formTarget = $state<number>(0);
	let formDescription = $state('');

	// Inline budget editing
	let editingBudgetId = $state<number | null>(null);
	let editingBudgetAmount = $state(0);

	onMount(() => {
		budgetStore.loadBudgetView();
	});

	function prevMonth() {
		if (budgetStore.month === 1) {
			budgetStore.month = 12;
			budgetStore.year--;
		} else {
			budgetStore.month--;
		}
		budgetStore.loadBudgetView();
	}

	function nextMonth() {
		if (budgetStore.month === 12) {
			budgetStore.month = 1;
			budgetStore.year++;
		} else {
			budgetStore.month++;
		}
		budgetStore.loadBudgetView();
	}

	function openCreateSeries() {
		editingSeriesId = null;
		formName = '';
		formArea = 'variable';
		formTarget = 0;
		formDescription = '';
		showSeriesForm = true;
	}

	function openEditSeries(line: BudgetLineItem) {
		const s = budgetStore.series.find((ser) => ser.id === line.series_id);
		if (!s) return;
		editingSeriesId = s.id;
		formName = s.name;
		formArea = s.budget_area;
		formTarget = s.target_amount ? toEuros(s.target_amount) : 0;
		formDescription = s.description ?? '';
		showSeriesForm = true;
	}

	async function handleSeriesSubmit() {
		if (!formName.trim()) return;
		if (editingSeriesId) {
			await budgetStore.updateSeries(editingSeriesId, {
				name: formName,
				budget_area: formArea,
				target_amount: formTarget || null,
				description: formDescription || null
			});
		} else {
			await budgetStore.createSeries({
				name: formName,
				budget_area: formArea,
				target_amount: formTarget || undefined,
				description: formDescription || undefined
			});
		}
		showSeriesForm = false;
	}

	function startEditBudget(line: BudgetLineItem) {
		editingBudgetId = line.series_id;
		editingBudgetAmount = toEuros(line.planned_amount);
	}

	async function saveBudget(seriesId: number) {
		await budgetStore.setMonthlyBudget(seriesId, editingBudgetAmount);
		editingBudgetId = null;
	}

	function progressPercent(line: BudgetLineItem): number {
		if (line.planned_amount === 0) return 0;
		// For income, positive actual = good. For expenses, negative actual vs negative planned.
		if (line.budget_area === 'income') {
			return Math.min((line.actual_amount / line.planned_amount) * 100, 100);
		}
		// Expenses: planned is negative, actual is negative
		if (line.planned_amount === 0) return 0;
		return Math.min((Math.abs(line.actual_amount) / Math.abs(line.planned_amount)) * 100, 150);
	}

	function progressColor(line: BudgetLineItem): string {
		const pct = progressPercent(line);
		if (line.budget_area === 'income') {
			return pct >= 100 ? 'bg-income' : 'bg-warning';
		}
		if (pct > 100) return 'bg-danger';
		if (pct > 80) return 'bg-warning';
		return 'bg-accent';
	}

	const budgetAreas: BudgetArea[] = ['income', 'recurring', 'variable', 'extras', 'savings', 'transfers'];
</script>

<svelte:head>
	<title>Budget — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-text-primary">Budget</h1>
		<button
			onclick={openCreateSeries}
			class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
		>
			<Plus size={16} />
			Nouvelle catégorie
		</button>
	</div>

	<!-- Navigation mois -->
	<div class="flex items-center justify-center gap-4">
		<button onclick={prevMonth} class="rounded-lg p-2 text-text-muted hover:bg-bg-hover hover:text-text-primary">
			<ChevronLeft size={20} />
		</button>
		<span class="text-lg font-semibold text-text-primary capitalize">
			{formatMonth(budgetStore.year, budgetStore.month)}
		</span>
		<button onclick={nextMonth} class="rounded-lg p-2 text-text-muted hover:bg-bg-hover hover:text-text-primary">
			<ChevronRight size={20} />
		</button>
	</div>

	{#if budgetStore.budgetLines.length === 0 && !budgetStore.loading}
		<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-12">
			<p class="text-lg font-medium text-text-secondary">Aucune catégorie de budget</p>
			<p class="text-sm text-text-muted">Créez des catégories pour planifier votre budget mensuel</p>
		</div>
	{:else}
		<!-- Résumé -->
		<div class="grid grid-cols-3 gap-4">
			<div class="rounded-xl border border-border bg-bg-card p-4 text-center">
				<p class="text-sm text-text-secondary">Planifié</p>
				<p class="text-xl font-bold text-text-primary">{formatCurrency(budgetStore.totalPlanned)}</p>
			</div>
			<div class="rounded-xl border border-border bg-bg-card p-4 text-center">
				<p class="text-sm text-text-secondary">Réalisé</p>
				<p class="text-xl font-bold text-text-primary">{formatCurrency(budgetStore.totalActual)}</p>
			</div>
			<div class="rounded-xl border border-border bg-bg-card p-4 text-center">
				<p class="text-sm text-text-secondary">Reste</p>
				<p class="text-xl font-bold {budgetStore.totalPlanned - budgetStore.totalActual >= 0 ? 'text-income' : 'text-expense'}">
					{formatCurrency(budgetStore.totalPlanned - budgetStore.totalActual)}
				</p>
			</div>
		</div>

		<!-- Budget par zone -->
		{#each budgetAreas as area}
			{@const lines = budgetStore.groupedByArea[area]}
			{#if lines.length > 0}
				<div class="rounded-xl border border-border bg-bg-card">
					<div class="border-b border-border px-4 py-3">
						<h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wide">
							{BUDGET_AREA_LABELS[area]}
						</h3>
					</div>
					<div class="divide-y divide-border">
						{#each lines as line (line.series_id)}
							<div class="px-4 py-3">
								<div class="flex items-center justify-between mb-2">
									<div class="flex items-center gap-2">
										<span class="text-sm font-medium text-text-primary">{line.series_name}</span>
										<button onclick={() => openEditSeries(line)} class="text-text-muted hover:text-text-primary">
											<Pencil size={12} />
										</button>
									</div>
									<div class="flex items-center gap-4 text-sm">
										{#if editingBudgetId === line.series_id}
											<input
												type="number"
												step="0.01"
												bind:value={editingBudgetAmount}
												onkeydown={(e) => e.key === 'Enter' && saveBudget(line.series_id)}
												onblur={() => saveBudget(line.series_id)}
												class="w-24 rounded border border-accent bg-bg-primary px-2 py-1 text-right text-sm text-text-primary outline-none"
											/>
										{:else}
											<button
												onclick={() => startEditBudget(line)}
												class="text-text-secondary hover:text-text-primary"
												title="Cliquer pour modifier le budget"
											>
												{formatCurrency(line.planned_amount)}
											</button>
										{/if}
										<span class="text-text-muted">/</span>
										<span class="{Math.abs(line.actual_amount) > Math.abs(line.planned_amount) && line.budget_area !== 'income' ? 'text-expense' : 'text-text-primary'}">
											{formatCurrency(line.actual_amount)}
										</span>
									</div>
								</div>
								<!-- Barre de progression -->
								<div class="h-2 w-full rounded-full bg-bg-hover">
									<div
										class="h-2 rounded-full transition-all {progressColor(line)}"
										style="width: {Math.min(progressPercent(line), 100)}%"
									></div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	{/if}
</div>

<!-- Modal ajout/édition série -->
{#if showSeriesForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={() => (showSeriesForm = false)}></div>
		<div class="relative w-full max-w-md rounded-xl border border-border bg-bg-secondary p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-text-primary">
					{editingSeriesId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
				</h2>
				<button onclick={() => (showSeriesForm = false)} class="text-text-muted hover:text-text-primary">
					<X size={20} />
				</button>
			</div>

			<form onsubmit={handleSeriesSubmit} class="space-y-4">
				<div>
					<label for="series-name" class="mb-1 block text-sm font-medium text-text-secondary">Nom *</label>
					<input
						id="series-name"
						bind:value={formName}
						required
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						placeholder="Courses alimentaires"
					/>
				</div>

				<div>
					<label for="series-area" class="mb-1 block text-sm font-medium text-text-secondary">Zone budget *</label>
					<select
						id="series-area"
						bind:value={formArea}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
					>
						{#each Object.entries(BUDGET_AREA_LABELS) as [value, label]}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="series-target" class="mb-1 block text-sm font-medium text-text-secondary">Montant cible mensuel</label>
					<input
						id="series-target"
						type="number"
						step="0.01"
						bind:value={formTarget}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
					/>
				</div>

				<div>
					<label for="series-desc" class="mb-1 block text-sm font-medium text-text-secondary">Description</label>
					<input
						id="series-desc"
						bind:value={formDescription}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						placeholder="Description optionnelle"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<button type="button" onclick={() => (showSeriesForm = false)} class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
						Annuler
					</button>
					{#if editingSeriesId}
						<button
							type="button"
							onclick={async () => { if (confirm('Supprimer cette catégorie ?')) { await budgetStore.removeSeries(editingSeriesId!); showSeriesForm = false; } }}
							class="rounded-lg px-4 py-2 text-sm text-danger hover:bg-danger/10"
						>
							Supprimer
						</button>
					{/if}
					<button type="submit" class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
						{editingSeriesId ? 'Enregistrer' : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
