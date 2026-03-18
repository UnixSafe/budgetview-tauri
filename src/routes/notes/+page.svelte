<script lang="ts">
	import { onMount } from 'svelte';
	import { StickyNote, ChevronLeft, ChevronRight, Save, Check } from 'lucide-svelte';
	import { notesStore } from '$lib/stores/notes.svelte';
	import { formatMonth } from '$lib/utils/format';
	import { toastStore } from '$lib/stores/toast.svelte';

	let saved = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	onMount(() => {
		notesStore.load();
	});

	function prevMonth() {
		if (notesStore.month === 1) {
			notesStore.setMonth(notesStore.year - 1, 12);
		} else {
			notesStore.setMonth(notesStore.year, notesStore.month - 1);
		}
	}

	function nextMonth() {
		if (notesStore.month === 12) {
			notesStore.setMonth(notesStore.year + 1, 1);
		} else {
			notesStore.setMonth(notesStore.year, notesStore.month + 1);
		}
	}

	function handleInput() {
		clearTimeout(debounceTimer);
		saved = false;
		debounceTimer = setTimeout(async () => {
			await notesStore.save();
			saved = true;
			setTimeout(() => (saved = false), 2000);
		}, 800);
	}

	async function handleSave() {
		await notesStore.save();
		toastStore.success('Note enregistrée');
		saved = true;
		setTimeout(() => (saved = false), 2000);
	}
</script>

<svelte:head>
	<title>Notes — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Notes</h1>
			<p class="mt-1 text-sm text-text-muted">Mémos et remarques sur votre budget</p>
		</div>
		<button
			onclick={handleSave}
			disabled={notesStore.saving}
			class="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20 disabled:opacity-40"
		>
			{#if saved}
				<Check size={15} />
				Enregistré
			{:else}
				<Save size={15} />
				{notesStore.saving ? 'Enregistrement...' : 'Enregistrer'}
			{/if}
		</button>
	</div>

	<!-- Month navigation -->
	<div class="flex items-center justify-center gap-6">
		<button onclick={prevMonth} class="rounded-xl p-2.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-smooth btn-press">
			<ChevronLeft size={22} />
		</button>
		<span class="text-xl font-bold text-text-primary capitalize min-w-[200px] text-center">
			{formatMonth(notesStore.year, notesStore.month)}
		</span>
		<button onclick={nextMonth} class="rounded-xl p-2.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-smooth btn-press">
			<ChevronRight size={22} />
		</button>
	</div>

	<!-- Note editor -->
	<div class="glass-card p-6">
		{#if notesStore.loading}
			<div class="flex items-center gap-3 py-8 justify-center">
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-accent/20 border-t-accent"></div>
				<span class="text-[13px] text-text-muted">Chargement...</span>
			</div>
		{:else}
			<textarea
				bind:value={notesStore.content}
				oninput={handleInput}
				placeholder="Écrivez vos notes pour ce mois... (objectifs, rappels, observations sur votre budget)"
				class="min-h-[300px] w-full resize-y rounded-xl border border-border bg-bg-primary/40 px-5 py-4 text-[14px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/15"
			></textarea>
			<div class="mt-3 flex items-center justify-between text-[12px] text-text-muted">
				<span>{notesStore.content.length} caractères</span>
				{#if saved}
					<span class="flex items-center gap-1 text-income animate-fade-in">
						<Check size={12} />
						Sauvegardé automatiquement
					</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Tips -->
	{#if !notesStore.content}
		<div class="flex flex-col items-center py-4">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated">
				<StickyNote size={28} class="text-text-muted" strokeWidth={1.5} />
			</div>
			<p class="text-[14px] font-medium text-text-secondary">Idées de notes</p>
			<ul class="mt-2 space-y-1 text-[13px] text-text-muted text-center">
				<li>Objectifs du mois (réduire les sorties restaurant)</li>
				<li>Dépenses exceptionnelles prévues</li>
				<li>Rappels de factures à vérifier</li>
				<li>Bilan du mois précédent</li>
			</ul>
		</div>
	{/if}
</div>
