<script lang="ts">
	import { goto } from '$app/navigation';
	import { undoStore } from '$lib/stores/undo.svelte';

	const shortcuts: Record<string, string> = {
		'd': '/dashboard',
		'c': '/accounts',
		't': '/transactions',
		'b': '/budget',
		'a': '/analysis',
		'i': '/import',
		'e': '/export',
		'r': '/recurring',
		'p': '/projects',
		'n': '/notes',
		's': '/settings',
	};

	function handleKeydown(e: KeyboardEvent) {
		// Escape closes help dialog
		if (e.key === 'Escape' && showHelp) {
			e.preventDefault();
			showHelp = false;
			return;
		}

		// Ctrl+Z for undo (works everywhere)
		if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
			if (undoStore.canUndo) {
				e.preventDefault();
				undoStore.undo();
				return;
			}
		}

		// Don't trigger shortcuts when typing in inputs
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;
		// Don't trigger with modifier keys (except for Ctrl+K which is handled by GlobalSearch)
		if (e.metaKey || e.ctrlKey || e.altKey) return;

		// g + key for navigation (like GitHub)
		if (e.key === '?') {
			e.preventDefault();
			showHelp = !showHelp;
			return;
		}

		const href = shortcuts[e.key.toLowerCase()];
		if (href) {
			e.preventDefault();
			goto(href);
		}
	}

	let showHelp = $state(false);
</script>

<svelte:window onkeydown={handleKeydown} />

{#if showHelp}
	<div class="fixed inset-0 z-[200] modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
		<button type="button" class="absolute inset-0" onclick={() => (showHelp = false)} aria-label="Fermer les raccourcis"></button>
		<div class="relative mx-auto mt-[12vh] w-full max-w-md px-4">
			<div class="glass-card shadow-2xl overflow-hidden animate-modal-in p-6">
				<h2 id="shortcuts-title" class="text-lg font-bold text-text-primary mb-5">Raccourcis clavier</h2>

				<div class="space-y-4">
					<div>
						<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Navigation</p>
						<div class="space-y-1.5">
							{#each Object.entries(shortcuts) as [key, href]}
								{@const labels: Record<string, string> = {
									'/dashboard': 'Tableau de bord',
									'/accounts': 'Comptes',
									'/transactions': 'Transactions',
									'/budget': 'Budget',
									'/analysis': 'Analyse',
									'/import': 'Import',
									'/export': 'Export',
									'/recurring': 'Récurrences',
									'/projects': 'Projets',
									'/notes': 'Notes',
									'/settings': 'Réglages',
								}}
								<div class="flex items-center justify-between py-1">
									<span class="text-[13px] text-text-secondary">{labels[href] ?? href}</span>
									<kbd class="rounded-md bg-bg-elevated px-2 py-0.5 text-[11px] font-mono font-semibold text-text-muted">{key.toUpperCase()}</kbd>
								</div>
							{/each}
						</div>
					</div>

					<div class="divider"></div>

					<div>
						<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Actions</p>
						<div class="space-y-1.5">
							<div class="flex items-center justify-between py-1">
								<span class="text-[13px] text-text-secondary">Annuler (undo)</span>
								<div class="flex gap-1">
									<kbd class="rounded-md bg-bg-elevated px-2 py-0.5 text-[11px] font-mono font-semibold text-text-muted">⌘</kbd>
									<kbd class="rounded-md bg-bg-elevated px-2 py-0.5 text-[11px] font-mono font-semibold text-text-muted">Z</kbd>
								</div>
							</div>
							<div class="flex items-center justify-between py-1">
								<span class="text-[13px] text-text-secondary">Recherche globale</span>
								<div class="flex gap-1">
									<kbd class="rounded-md bg-bg-elevated px-2 py-0.5 text-[11px] font-mono font-semibold text-text-muted">⌘</kbd>
									<kbd class="rounded-md bg-bg-elevated px-2 py-0.5 text-[11px] font-mono font-semibold text-text-muted">K</kbd>
								</div>
							</div>
							<div class="flex items-center justify-between py-1">
								<span class="text-[13px] text-text-secondary">Aide raccourcis</span>
								<kbd class="rounded-md bg-bg-elevated px-2 py-0.5 text-[11px] font-mono font-semibold text-text-muted">?</kbd>
							</div>
						</div>
					</div>
				</div>

				<button
					onclick={() => (showHelp = false)}
					class="mt-6 w-full rounded-xl bg-bg-hover px-4 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-smooth"
				>
					Fermer
				</button>
			</div>
		</div>
	</div>
{/if}
