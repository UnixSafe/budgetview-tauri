<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Trash2, Search, Tag, X } from 'lucide-svelte';
	import { query, execute } from '$lib/stores/db';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	interface Keyword {
		id: number;
		pattern: string;
		series_id: number;
		series_name: string;
		priority: number;
		is_user_defined: boolean;
	}

	let keywords = $state<Keyword[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');

	// Add form
	let showAdd = $state(false);
	let newPattern = $state('');
	let newSeriesId = $state<number | string>('');
	let newPriority = $state(8);

	onMount(async () => {
		await Promise.all([loadKeywords(), budgetStore.loadSeries()]);
	});

	async function loadKeywords() {
		loading = true;
		try {
			keywords = await query<Keyword>(
				`SELECT ck.id, ck.pattern, ck.series_id, bs.name as series_name, ck.priority, ck.is_user_defined
				 FROM category_keywords ck
				 LEFT JOIN budget_series bs ON ck.series_id = bs.id
				 ORDER BY bs.name, ck.priority DESC, ck.pattern`
			);
		} catch { keywords = []; }
		loading = false;
	}

	let filteredKeywords = $derived(
		searchQuery
			? keywords.filter(k =>
				k.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(k.series_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
			: keywords
	);

	let groupedByCategory = $derived.by(() => {
		const groups: Record<string, Keyword[]> = {};
		for (const kw of filteredKeywords) {
			const name = kw.series_name ?? 'Sans catégorie';
			if (!groups[name]) groups[name] = [];
			groups[name].push(kw);
		}
		return groups;
	});

	async function handleAdd() {
		if (!newPattern.trim() || newSeriesId === '') return;
		await execute(
			'INSERT OR IGNORE INTO category_keywords (pattern, series_id, priority, is_user_defined) VALUES ($1, $2, $3, 1)',
			[newPattern.trim().toUpperCase(), Number(newSeriesId), newPriority]
		);
		toastStore.success(`Mot-clé "${newPattern.trim()}" ajouté`);
		newPattern = '';
		showAdd = false;
		await loadKeywords();
	}

	async function handleDelete(kw: Keyword) {
		if (!confirm(`Supprimer le mot-clé "${kw.pattern}" ?`)) return;
		await execute('DELETE FROM category_keywords WHERE id = $1', [kw.id]);
		toastStore.success('Mot-clé supprimé');
		await loadKeywords();
	}
</script>

<svelte:head>
	<title>Mots-clés — BudgetView</title>
</svelte:head>

<div class="space-y-8 animate-fade-in">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Mots-clés</h1>
			<p class="mt-1 text-sm text-text-muted">
				Dictionnaire d'auto-catégorisation — {keywords.length} mot{keywords.length > 1 ? 's' : ''}-clé{keywords.length > 1 ? 's' : ''}
			</p>
		</div>
		<button
			onclick={() => (showAdd = !showAdd)}
			class="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20"
		>
			<Plus size={15} strokeWidth={2.5} />
			Ajouter
		</button>
	</div>

	<!-- Add form -->
	{#if showAdd}
		<div class="glass-card p-5 animate-slide-down">
			<form onsubmit={handleAdd} class="flex items-end gap-3 flex-wrap">
				<div class="flex-1 min-w-[160px]">
					<label for="kw-pattern" class="mb-1 block text-[11px] font-medium text-text-muted">Mot-clé (sera mis en majuscules)</label>
					<input id="kw-pattern" bind:value={newPattern} required placeholder="CARREFOUR, LIDL..."
						class="w-full rounded-xl border border-border bg-bg-input px-3 py-2.5 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
				</div>
				<div class="w-48">
					<label for="kw-series" class="mb-1 block text-[11px] font-medium text-text-muted">Catégorie cible</label>
					<select id="kw-series" bind:value={newSeriesId} required
						class="w-full rounded-xl border border-border bg-bg-input px-3 py-2.5 text-[13px] text-text-primary outline-none focus-ring">
						<option value="">Choisir...</option>
						{#each budgetStore.series as series}
							<option value={series.id}>{series.name}</option>
						{/each}
					</select>
				</div>
				<div class="w-20">
					<label for="kw-priority" class="mb-1 block text-[11px] font-medium text-text-muted">Priorité</label>
					<input id="kw-priority" type="number" min="1" max="10" bind:value={newPriority}
						class="w-full rounded-xl border border-border bg-bg-input px-3 py-2.5 text-[13px] text-text-primary outline-none focus-ring" />
				</div>
				<button type="submit"
					class="rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover">
					Ajouter
				</button>
				<button type="button" onclick={() => (showAdd = false)}
					class="rounded-xl px-3 py-2.5 text-text-muted hover:text-text-primary transition-smooth">
					<X size={16} />
				</button>
			</form>
		</div>
	{/if}

	<!-- Search -->
	<div class="relative">
		<Search size={15} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
		<input bind:value={searchQuery} placeholder="Rechercher un mot-clé ou une catégorie..."
			class="w-full rounded-xl border border-border bg-bg-card/60 py-2.5 pl-10 pr-4 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
	</div>

	{#if loading}
		<LoadingSpinner message="Chargement..." />
	{:else if filteredKeywords.length === 0}
		<div class="flex flex-col items-center justify-center glass-card p-16">
			<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-bg-elevated">
				<Tag size={32} class="text-text-muted" strokeWidth={1.5} />
			</div>
			<p class="text-xl font-semibold text-text-primary">Aucun mot-clé</p>
			<p class="mt-1 text-sm text-text-muted">{searchQuery ? 'Aucun résultat' : 'Ajoutez des mots-clés pour l\'auto-catégorisation'}</p>
		</div>
	{:else}
		<!-- Grouped by category -->
		<div class="space-y-4 stagger-children">
			{#each Object.entries(groupedByCategory) as [category, kws]}
				<div class="glass-card overflow-hidden">
					<div class="flex items-center justify-between border-b border-border-light px-5 py-3">
						<h3 class="text-[13px] font-bold text-accent">{category}</h3>
						<span class="text-[11px] text-text-muted">{kws.length} mot{kws.length > 1 ? 's' : ''}-clé{kws.length > 1 ? 's' : ''}</span>
					</div>
					<div class="flex flex-wrap gap-2 p-4">
						{#each kws as kw}
							<div class="group flex items-center gap-1.5 rounded-xl bg-bg-primary/40 px-3 py-1.5 transition-smooth hover:bg-bg-hover">
								<span class="text-[12px] font-medium text-text-primary">{kw.pattern}</span>
								{#if kw.is_user_defined}
									<span class="text-[9px] text-accent font-semibold">perso</span>
								{/if}
								<button
									onclick={() => handleDelete(kw)}
									class="rounded p-0.5 text-text-muted/30 hover:text-danger transition-smooth opacity-0 group-hover:opacity-100"
									aria-label="Supprimer {kw.pattern}"
								>
									<X size={12} />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
