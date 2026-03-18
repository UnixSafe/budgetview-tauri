<script lang="ts">
	import { onMount } from 'svelte';
	import { Trash2, Settings, Tag, Search } from 'lucide-svelte';
	import { categorizationStore } from '$lib/stores/categorization.svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { CategorizationRule } from '$lib/types';
	import { formatDate } from '$lib/utils/format';

	let searchQuery = $state('');
	let editingRuleId = $state<number | null>(null);
	let editSeriesId = $state<number | string>('');

	onMount(async () => {
		await Promise.all([
			categorizationStore.load(),
			budgetStore.loadSeries()
		]);
	});

	let filteredRules = $derived(
		searchQuery
			? categorizationStore.rules.filter(
					(r) =>
						r.label_pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
						(r.series_name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
				)
			: categorizationStore.rules
	);

	async function handleDelete(rule: CategorizationRule) {
		if (!confirm(`Supprimer la règle pour "${rule.label_pattern}" ?`)) return;
		await categorizationStore.remove(rule.id);
		toastStore.success('Règle supprimée');
	}

	function startEditSeries(rule: CategorizationRule) {
		editingRuleId = rule.id;
		editSeriesId = rule.series_id;
	}

	async function saveEditSeries(ruleId: number) {
		if (editSeriesId === '') return;
		await categorizationStore.updateRule(ruleId, Number(editSeriesId));
		editingRuleId = null;
		toastStore.success('Règle modifiée');
	}

	function confidenceLabel(matchCount: number): string {
		if (matchCount >= 3) return 'Auto';
		if (matchCount >= 1) return 'Suggestion';
		return 'Nouveau';
	}

	function confidenceClass(matchCount: number): string {
		if (matchCount >= 3) return 'bg-income/10 text-income';
		if (matchCount >= 1) return 'bg-warning/10 text-warning';
		return 'bg-bg-hover text-text-muted';
	}
</script>

<svelte:head>
	<title>Règles de catégorisation — BudgetView</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Settings size={24} class="text-text-muted" />
			<div>
				<h1 class="text-2xl font-bold text-text-primary">Règles de catégorisation</h1>
				<p class="text-sm text-text-muted">
					Les règles sont apprises automatiquement quand vous catégorisez des transactions.
					Après 3 utilisations, elles sont appliquées automatiquement à l'import.
				</p>
			</div>
		</div>
	</div>

	{#if categorizationStore.loading}
		<LoadingSpinner message="Chargement des règles..." />
	{:else}
		<!-- Stats -->
		<div class="grid grid-cols-3 gap-4">
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<p class="text-xs font-medium text-text-muted">Total règles</p>
				<p class="mt-1 text-2xl font-semibold text-text-primary">{categorizationStore.rules.length}</p>
			</div>
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<p class="text-xs font-medium text-text-muted">Règles actives (3+)</p>
				<p class="mt-1 text-2xl font-semibold text-income">
					{categorizationStore.rules.filter((r) => r.match_count >= 3).length}
				</p>
			</div>
			<div class="rounded-xl border border-border bg-bg-card p-4">
				<p class="text-xs font-medium text-text-muted">En apprentissage</p>
				<p class="mt-1 text-2xl font-semibold text-warning">
					{categorizationStore.rules.filter((r) => r.match_count < 3).length}
				</p>
			</div>
		</div>

		<!-- Search -->
		<div class="relative">
			<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
			<input
				bind:value={searchQuery}
				placeholder="Rechercher une règle..."
				class="w-full rounded-lg border border-border bg-bg-card py-2 pl-9 pr-3 text-sm text-text-primary outline-none focus:border-accent"
			/>
		</div>

		<!-- Rules list -->
		{#if filteredRules.length === 0}
			<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-12">
				<Tag size={48} class="mb-4 text-text-muted" />
				<p class="text-lg font-medium text-text-secondary">Aucune règle</p>
				<p class="text-sm text-text-muted">
					{searchQuery
						? 'Aucune règle ne correspond à votre recherche'
						: 'Catégorisez des transactions pour créer des règles automatiquement'}
				</p>
			</div>
		{:else}
			<div class="overflow-hidden rounded-xl border border-border">
				<table class="w-full">
					<thead>
						<tr class="border-b border-border bg-bg-secondary text-left text-sm text-text-secondary">
							<th class="px-4 py-3 font-medium">Label</th>
							<th class="px-4 py-3 font-medium">Catégorie</th>
							<th class="px-4 py-3 text-center font-medium">Confiance</th>
							<th class="px-4 py-3 text-center font-medium">Utilisations</th>
							<th class="px-4 py-3 font-medium">Dernière utilisation</th>
							<th class="w-16 px-4 py-3"></th>
						</tr>
					</thead>
					<tbody>
						{#each filteredRules as rule (rule.id)}
							<tr class="border-b border-border transition-colors hover:bg-bg-hover">
								<td class="px-4 py-3">
									<p class="text-sm font-medium text-text-primary">{rule.label_pattern}</p>
								</td>
								<td class="px-4 py-3">
									{#if editingRuleId === rule.id}
										<div class="flex items-center gap-2">
											<select
												bind:value={editSeriesId}
												class="rounded-lg border border-border bg-bg-primary px-2 py-1 text-sm text-text-primary outline-none focus:border-accent"
											>
												{#each budgetStore.series as series}
													<option value={series.id}>{series.name}</option>
												{/each}
											</select>
											<button
												onclick={() => saveEditSeries(rule.id)}
												class="rounded bg-accent px-2 py-1 text-xs text-white hover:bg-accent-hover"
											>
												OK
											</button>
											<button
												onclick={() => (editingRuleId = null)}
												class="text-xs text-text-muted hover:text-text-primary"
											>
												Annuler
											</button>
										</div>
									{:else}
										<button
											onclick={() => startEditSeries(rule)}
											class="flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-xs text-accent hover:bg-accent/20"
										>
											<Tag size={12} />
											{rule.series_name ?? 'Inconnue'}
										</button>
									{/if}
								</td>
								<td class="px-4 py-3 text-center">
									<span class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {confidenceClass(rule.match_count)}">
										{confidenceLabel(rule.match_count)}
									</span>
								</td>
								<td class="px-4 py-3 text-center text-sm font-medium text-text-primary">{rule.match_count}</td>
								<td class="px-4 py-3 text-sm text-text-secondary">
									{rule.last_used_at ? formatDate(rule.last_used_at) : '—'}
								</td>
								<td class="px-4 py-3">
									<button
										onclick={() => handleDelete(rule)}
										class="rounded p-1 text-text-muted hover:text-danger"
									>
										<Trash2 size={14} />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
