<script lang="ts">
	import { goto } from '$app/navigation';
	import { Search, ArrowLeftRight, Landmark, PieChart, X } from 'lucide-svelte';
	import { query } from '$lib/stores/db';
	import { confidentialStore } from '$lib/stores/confidential.svelte';

	interface SearchResult {
		type: 'transaction' | 'account' | 'series';
		id: number;
		title: string;
		subtitle: string;
		href: string;
	}

	let open = $state(false);
	let searchQuery = $state('');
	let results = $state<SearchResult[]>([]);
	let selectedIndex = $state(0);
	let searchInput = $state<HTMLInputElement>(undefined!);
	let debounceTimer: ReturnType<typeof setTimeout>;

	export function toggle() {
		open = !open;
		if (open) {
			searchQuery = '';
			results = [];
			selectedIndex = 0;
			// Focus input after render
			setTimeout(() => searchInput?.focus(), 50);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
		} else if (e.key === 'Enter' && results[selectedIndex]) {
			open = false;
			goto(results[selectedIndex].href);
		}
	}

	function handleInput() {
		clearTimeout(debounceTimer);
		const q = searchQuery.trim();
		if (q.length < 2) { results = []; return; }
		debounceTimer = setTimeout(() => doSearch(q), 150);
	}

	async function doSearch(q: string) {
		const pattern = `%${q}%`;
		const [txs, accounts, series] = await Promise.all([
			query<{ id: number; label: string; amount: number; date: string }>(
				`SELECT id, label, amount, date FROM transactions WHERE label LIKE $1 ORDER BY date DESC LIMIT 5`,
				[pattern]
			),
			query<{ id: number; name: string; bank_name: string | null }>(
				`SELECT id, name, bank_name FROM accounts WHERE name LIKE $1 OR bank_name LIKE $1 ORDER BY name LIMIT 3`,
				[pattern]
			),
			query<{ id: number; name: string; budget_area: string }>(
				`SELECT id, name, budget_area FROM budget_series WHERE name LIKE $1 AND is_active = 1 ORDER BY name LIMIT 3`,
				[pattern]
			),
		]);

		const combined: SearchResult[] = [
			...accounts.map(a => ({
				type: 'account' as const,
				id: a.id,
				title: a.name,
				subtitle: a.bank_name ?? 'Compte',
				href: '/accounts',
			})),
			...series.map(s => ({
				type: 'series' as const,
				id: s.id,
				title: s.name,
				subtitle: s.budget_area,
				href: '/budget',
			})),
			...txs.map(t => ({
				type: 'transaction' as const,
				id: t.id,
				title: t.label,
				subtitle: `${t.date} · ${confidentialStore.format(t.amount)}`,
				href: '/transactions',
			})),
		];

		results = combined;
		selectedIndex = 0;
	}

	function selectResult(result: SearchResult) {
		open = false;
		goto(result.href);
	}

	const typeIcons = {
		transaction: ArrowLeftRight,
		account: Landmark,
		series: PieChart,
	};

	const typeLabels = {
		transaction: 'Transaction',
		account: 'Compte',
		series: 'Catégorie',
	};
</script>

<svelte:window onkeydown={(e) => {
	if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
		e.preventDefault();
		toggle();
	}
}} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[200] modal-overlay animate-fade-in" onclick={() => (open = false)}>
		<!-- Search dialog -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="mx-auto mt-[15vh] w-full max-w-xl px-4" onclick={(e) => e.stopPropagation()}>
			<div class="glass-card shadow-2xl overflow-hidden animate-modal-in">
				<!-- Search input -->
				<div class="flex items-center gap-3 border-b border-glass-border px-5 py-4">
					<Search size={18} class="text-text-muted shrink-0" />
					<input
						bind:this={searchInput}
						bind:value={searchQuery}
						oninput={handleInput}
						onkeydown={handleKeydown}
						placeholder="Rechercher transactions, comptes, catégories..."
						class="flex-1 bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-muted/60"
					/>
					<div class="flex items-center gap-1.5">
						<kbd class="rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">ESC</kbd>
					</div>
				</div>

				<!-- Results -->
				{#if results.length > 0}
					<div class="max-h-80 overflow-y-auto py-2">
						{#each results as result, i (result.type + result.id)}
							{@const Icon = typeIcons[result.type]}
							<button
								onclick={() => selectResult(result)}
								class="flex w-full items-center gap-3.5 px-5 py-3 text-left transition-smooth
									{i === selectedIndex ? 'bg-accent/10' : 'hover:bg-bg-hover'}"
							>
								<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
									{result.type === 'account' ? 'bg-accent/10' : result.type === 'series' ? 'bg-warning/10' : 'bg-bg-elevated'}">
									<Icon size={16} class={result.type === 'account' ? 'text-accent' : result.type === 'series' ? 'text-warning' : 'text-text-muted'} />
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-[13px] font-medium text-text-primary truncate">{result.title}</p>
									<p class="text-[11px] text-text-muted">{result.subtitle}</p>
								</div>
								<span class="text-[10px] font-medium text-text-muted/50 uppercase">{typeLabels[result.type]}</span>
							</button>
						{/each}
					</div>
				{:else if searchQuery.length >= 2}
					<div class="px-5 py-8 text-center">
						<p class="text-[13px] text-text-muted">Aucun résultat pour « {searchQuery} »</p>
					</div>
				{:else}
					<div class="px-5 py-6 text-center">
						<p class="text-[12px] text-text-muted">Tapez au moins 2 caractères pour rechercher</p>
						<div class="mt-4 flex items-center justify-center gap-4 text-[11px] text-text-muted/60">
							<span><kbd class="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd> Naviguer</span>
							<span><kbd class="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px]">↵</kbd> Ouvrir</span>
							<span><kbd class="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> Fermer</span>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
