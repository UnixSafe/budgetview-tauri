<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, FolderKanban, Pencil, Trash2, X, Calendar, PlusCircle } from 'lucide-svelte';
	import { projectStore } from '$lib/stores/projects.svelte';
	import type { ProjectWithProgress } from '$lib/stores/projects.svelte';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { formatCurrency, toEuros } from '$lib/utils/format';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';

	let showForm = $state(false);
	let editingId = $state<number | null>(null);
	let formName = $state('');
	let formTargetAmount = $state<number | undefined>(undefined);
	let formTargetDate = $state('');
	let formAccountId = $state<number | string>('');

	let addingItemToProject = $state<number | null>(null);
	let itemLabel = $state('');
	let itemAmount = $state(0);

	onMount(async () => {
		await Promise.all([projectStore.load(), accountStore.load()]);
	});

	function openCreate() {
		editingId = null; formName = ''; formTargetAmount = undefined; formTargetDate = ''; formAccountId = '';
		showForm = true;
	}

	function openEdit(project: ProjectWithProgress) {
		editingId = project.id; formName = project.name;
		formTargetAmount = project.target_amount ? toEuros(project.target_amount) : undefined;
		formTargetDate = project.target_date ?? ''; formAccountId = project.account_id ?? '';
		showForm = true;
	}

	async function handleSubmit() {
		if (!formName.trim()) return;
		const accountId = formAccountId === '' ? null : Number(formAccountId);
		if (editingId) {
			await projectStore.update(editingId, { name: formName, target_amount: formTargetAmount ?? null, target_date: formTargetDate || null, account_id: accountId });
		} else {
			await projectStore.create({ name: formName, target_amount: formTargetAmount, target_date: formTargetDate || undefined, account_id: accountId ?? undefined });
		}
		toastStore.success(editingId ? 'Projet modifié' : 'Projet créé');
		showForm = false;
	}

	async function handleAddItem(projectId: number) {
		if (!itemLabel.trim() || !itemAmount) return;
		await projectStore.addItem(projectId, { label: itemLabel, planned_amount: itemAmount });
		toastStore.success('Élément ajouté');
		addingItemToProject = null; itemLabel = ''; itemAmount = 0;
	}

	function getProgress(project: ProjectWithProgress): number {
		if (!project.target_amount || project.target_amount === 0) return 0;
		return Math.min((project.total_saved / project.target_amount) * 100, 100);
	}
</script>

<svelte:head>
	<title>Projets — BudgetView</title>
</svelte:head>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Projets</h1>
			<p class="mt-1 text-sm text-text-muted">Planifiez vos objectifs d'épargne</p>
		</div>
		<button onclick={openCreate}
			class="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20">
			<Plus size={16} strokeWidth={2.5} />
			Nouveau projet
		</button>
	</div>

	{#if projectStore.error}
		<ErrorBanner message={projectStore.error} ondismiss={() => (projectStore.error = null)} />
	{/if}

	{#if projectStore.loading}
		<LoadingSpinner message="Chargement..." />
	{:else if projectStore.projects.length === 0}
		<div class="flex flex-col items-center justify-center glass-card p-16">
			<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10 text-3xl">
				🎯
			</div>
			<p class="text-xl font-semibold text-text-primary">Aucun projet</p>
			<p class="mt-1 text-sm text-text-muted">Créez un projet pour planifier vos objectifs</p>
			<button onclick={openCreate}
				class="mt-6 flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-smooth btn-press hover:bg-accent-hover">
				<Plus size={16} />Commencer
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-2 stagger-children">
			{#each projectStore.projects as project (project.id)}
				{@const pct = getProgress(project)}
				<div class="glass-card p-6">
					<div class="mb-4 flex items-start justify-between">
						<div>
							<h2 class="text-lg font-bold tracking-tight text-text-primary">{project.name}</h2>
							{#if project.target_date}
								<p class="flex items-center gap-1.5 text-[12px] text-text-muted mt-1">
									<Calendar size={12} />
									Objectif : {new Date(project.target_date).toLocaleDateString('fr-FR')}
								</p>
							{/if}
						</div>
						<div class="flex gap-1">
							<button onclick={() => openEdit(project)} class="rounded-xl p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
								<Pencil size={14} />
							</button>
							<button onclick={() => { if (confirm('Supprimer ce projet ?')) projectStore.remove(project.id); }} class="rounded-xl p-2 text-text-muted hover:text-danger hover:bg-danger/10 transition-smooth">
								<Trash2 size={14} />
							</button>
						</div>
					</div>

					{#if project.target_amount}
						<div class="mb-5">
							<div class="mb-2 flex items-center justify-between text-[13px]">
								<span class="text-text-secondary tabular-nums">
									{formatCurrency(project.total_saved)} / {formatCurrency(project.target_amount)}
								</span>
								<span class="font-bold text-accent tabular-nums">{pct.toFixed(0)}%</span>
							</div>
							<div class="h-2 w-full rounded-full bg-bg-elevated overflow-hidden">
								<div class="h-full rounded-full bg-accent progress-bar" style="width: {pct}%"></div>
							</div>
						</div>
					{/if}

					{#if project.items.length > 0}
						<div class="mb-4 space-y-1.5">
							{#each project.items as item (item.id)}
								<div class="flex items-center justify-between rounded-xl bg-bg-primary/30 px-4 py-2.5 text-[13px]">
									<span class="text-text-primary">{item.label}</span>
									<div class="flex items-center gap-2">
										<span class="font-medium text-text-secondary tabular-nums">{formatCurrency(item.planned_amount)}</span>
										<button onclick={() => { if (confirm('Supprimer ?')) projectStore.removeItem(item.id); }} class="text-text-muted hover:text-danger transition-smooth">
											<X size={13} />
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					{#if addingItemToProject === project.id}
						<div class="flex items-center gap-2">
							<input bind:value={itemLabel} placeholder="Libellé"
								class="flex-1 rounded-xl border border-border bg-bg-primary/60 px-3 py-2.5 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
							<input type="number" step="0.01" bind:value={itemAmount} placeholder="€"
								class="w-24 rounded-xl border border-border bg-bg-primary/60 px-3 py-2.5 text-[13px] text-text-primary outline-none focus-ring" />
							<button onclick={() => handleAddItem(project.id)}
								class="rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover">OK</button>
							<button onclick={() => (addingItemToProject = null)} class="text-text-muted hover:text-text-primary transition-smooth"><X size={16} /></button>
						</div>
					{:else}
						<button onclick={() => { addingItemToProject = project.id; itemLabel = ''; itemAmount = 0; }}
							class="flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-accent transition-smooth">
							<PlusCircle size={14} />Ajouter un élément
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal -->
{#if showForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={() => (showForm = false)}></div>
		<div class="relative w-full max-w-md glass-card p-7 shadow-2xl animate-modal-in mx-4">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-bold tracking-tight text-text-primary">{editingId ? 'Modifier' : 'Nouveau projet'}</h2>
				<button onclick={() => (showForm = false)} class="rounded-xl p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth"><X size={18} /></button>
			</div>
			<form onsubmit={handleSubmit} class="space-y-5">
				<div>
					<label for="proj-name" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Nom *</label>
					<input id="proj-name" bind:value={formName} required
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted" placeholder="Vacances d'été" />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="proj-target" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Montant cible</label>
						<input id="proj-target" type="number" step="0.01" bind:value={formTargetAmount}
							class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring" placeholder="2000" />
					</div>
					<div>
						<label for="proj-date" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Date cible</label>
						<input id="proj-date" type="date" bind:value={formTargetDate}
							class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring" />
					</div>
				</div>
				<div>
					<label for="proj-account" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Compte associé</label>
					<select id="proj-account" bind:value={formAccountId}
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring">
						<option value="">Aucun</option>
						{#each accountStore.accounts as account}
							<option value={account.id}>{account.name}</option>
						{/each}
					</select>
				</div>
				<div class="flex justify-end gap-3 pt-3">
					<button type="button" onclick={() => (showForm = false)} class="rounded-xl px-5 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-smooth">Annuler</button>
					<button type="submit" class="rounded-xl bg-accent px-6 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20">
						{editingId ? 'Enregistrer' : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
