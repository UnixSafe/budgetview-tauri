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
		await Promise.all([categorizationStore.load(), budgetStore.loadSeries()]);
	});

	let filteredRules = $derived(
		searchQuery
			? categorizationStore.rules.filter((r) =>
					r.label_pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
					(r.series_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
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
		return 'bg-bg-elevated text-text-muted';
	}
</script>

<svelte:head>
	<title>Règles — BudgetView</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary">Règles de catégorisation</h1>
		<p class="mt-1 text-sm text-text-muted">
			Apprises automatiquement. Après 3 utilisations, elles s'appliquent à l'import.
		</p>
	</div>

	{#if categorizationStore.loading}
		<LoadingSpinner message="Chargement des règles..." />
	{:else}
		<!-- Stats -->
		<div class="grid grid-cols-3 gap-3 stagger-children">
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total</p>
				<p class="mt-2 text-2xl font-bold text-text-primary">{categorizationStore.rules.length}</p>
			</div>
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Actives (3+)</p>
				<p class="mt-2 text-2xl font-bold text-income">{categorizationStore.rules.filter((r) => r.match_count >= 3).length}</p>
			</div>
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Apprentissage</p>
				<p class="mt-2 text-2xl font-bold text-warning">{categorizationStore.rules.filter((r) => r.match_count < 3).length}</p>
			</div>
		</div>

		<!-- Search -->
		<div class="relative">
			<Search size={15} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
			<input bind:value={searchQuery} placeholder="Rechercher une règle..."
				class="w-full rounded-xl border border-border bg-bg-card/60 py-2.5 pl-10 pr-4 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
		</div>

		{#if filteredRules.length === 0}
			<div class="flex flex-col items-center justify-center glass-card p-16">
				<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-bg-elevated">
					<Tag size={32} class="text-text-muted" strokeWidth={1.5} />
				</div>
				<p class="text-xl font-semibold text-text-primary">Aucune règle</p>
				<p class="mt-1 text-sm text-text-muted">
					{searchQuery ? 'Aucun résultat' : 'Catégorisez des transactions pour créer des règles'}
				</p>
			</div>
		{:else}
			<div class="glass-card overflow-hidden">
				<table class="w-full">
					<thead>
						<tr class="border-b border-border-light text-left text-[12px] font-semibold text-text-muted uppercase tracking-wider">
							<th class="px-5 py-3.5">Libellé</th>
							<th class="px-5 py-3.5">Catégorie</th>
							<th class="px-5 py-3.5 text-center">Confiance</th>
							<th class="px-5 py-3.5 text-center">Utilisations</th>
							<th class="px-5 py-3.5">Dernière</th>
							<th class="w-14 px-5 py-3.5"></th>
						</tr>
					</thead>
					<tbody>
						{#each filteredRules as rule (rule.id)}
							<tr class="border-b border-border-light/50 hover-row">
								<td class="px-5 py-3.5">
									<p class="text-[13px] font-medium text-text-primary">{rule.label_pattern}</p>
								</td>
								<td class="px-5 py-3.5">
									{#if editingRuleId === rule.id}
										<div class="flex items-center gap-2">
											<select bind:value={editSeriesId}
												class="rounded-xl border border-border bg-bg-primary/60 px-3 py-1.5 text-[13px] text-text-primary outline-none focus-ring">
												{#each budgetStore.series as series}
													<option value={series.id}>{series.name}</option>
												{/each}
											</select>
											<button onclick={() => saveEditSeries(rule.id)}
												class="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover">OK</button>
											<button onclick={() => (editingRuleId = null)}
												class="text-[12px] text-text-muted hover:text-text-primary transition-smooth">Annuler</button>
										</div>
									{:else}
										<button onclick={() => startEditSeries(rule)}
											class="flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1.5 text-[12px] font-medium text-accent hover:bg-accent/15 transition-smooth">
											<Tag size={11} />{rule.series_name ?? 'Inconnue'}
										</button>
									{/if}
								</td>
								<td class="px-5 py-3.5 text-center">
									<span class="badge {confidenceClass(rule.match_count)}">{confidenceLabel(rule.match_count)}</span>
								</td>
								<td class="px-5 py-3.5 text-center text-[13px] font-semibold text-text-primary tabular-nums">{rule.match_count}</td>
								<td class="px-5 py-3.5 text-[13px] text-text-muted tabular-nums">{rule.last_used_at ? formatDate(rule.last_used_at) : '—'}</td>
								<td class="px-5 py-3.5">
									<button onclick={() => handleDelete(rule)}
										class="rounded-lg p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-smooth">
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
