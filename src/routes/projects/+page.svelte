<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, FolderKanban, Pencil, Trash2, X, Target, Calendar, PlusCircle } from 'lucide-svelte';
	import { projectStore } from '$lib/stores/projects.svelte';
	import type { ProjectWithProgress } from '$lib/stores/projects.svelte';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { formatCurrency } from '$lib/utils/format';

	let showForm = $state(false);
	let editingId = $state<number | null>(null);
	let formName = $state('');
	let formTargetAmount = $state<number | undefined>(undefined);
	let formTargetDate = $state('');
	let formAccountId = $state<number | null>(null);

	// Item form
	let addingItemToProject = $state<number | null>(null);
	let itemLabel = $state('');
	let itemAmount = $state(0);

	onMount(async () => {
		await Promise.all([projectStore.load(), accountStore.load()]);
	});

	function openCreate() {
		editingId = null;
		formName = '';
		formTargetAmount = undefined;
		formTargetDate = '';
		formAccountId = null;
		showForm = true;
	}

	function openEdit(project: ProjectWithProgress) {
		editingId = project.id;
		formName = project.name;
		formTargetAmount = project.target_amount ?? undefined;
		formTargetDate = project.target_date ?? '';
		formAccountId = project.account_id;
		showForm = true;
	}

	async function handleSubmit() {
		if (!formName.trim()) return;
		if (editingId) {
			await projectStore.update(editingId, {
				name: formName,
				target_amount: formTargetAmount ?? null,
				target_date: formTargetDate || null,
				account_id: formAccountId
			});
		} else {
			await projectStore.create({
				name: formName,
				target_amount: formTargetAmount,
				target_date: formTargetDate || undefined,
				account_id: formAccountId ?? undefined
			});
		}
		showForm = false;
	}

	async function handleAddItem(projectId: number) {
		if (!itemLabel.trim() || !itemAmount) return;
		await projectStore.addItem(projectId, {
			label: itemLabel,
			planned_amount: itemAmount
		});
		addingItemToProject = null;
		itemLabel = '';
		itemAmount = 0;
	}

	function getProgress(project: ProjectWithProgress): number {
		if (!project.target_amount || project.target_amount === 0) return 0;
		return Math.min((project.total_saved / project.target_amount) * 100, 100);
	}
</script>

<svelte:head>
	<title>Projets — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-text-primary">Projets</h1>
		<button
			onclick={openCreate}
			class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
		>
			<Plus size={16} />
			Nouveau projet
		</button>
	</div>

	{#if projectStore.projects.length === 0 && !projectStore.loading}
		<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-12">
			<FolderKanban size={48} class="mb-4 text-text-muted" />
			<p class="text-lg font-medium text-text-secondary">Aucun projet</p>
			<p class="text-sm text-text-muted">Créez un projet pour planifier vos objectifs d'épargne</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{#each projectStore.projects as project (project.id)}
				{@const pct = getProgress(project)}
				<div class="rounded-xl border border-border bg-bg-card p-5">
					<div class="mb-3 flex items-start justify-between">
						<div>
							<h2 class="text-lg font-semibold text-text-primary">{project.name}</h2>
							{#if project.target_date}
								<p class="flex items-center gap-1 text-xs text-text-muted">
									<Calendar size={12} />
									Objectif : {new Date(project.target_date).toLocaleDateString('fr-FR')}
								</p>
							{/if}
						</div>
						<div class="flex gap-1">
							<button onclick={() => openEdit(project)} class="rounded p-1.5 text-text-muted hover:text-text-primary">
								<Pencil size={14} />
							</button>
							<button onclick={() => projectStore.remove(project.id)} class="rounded p-1.5 text-text-muted hover:text-danger">
								<Trash2 size={14} />
							</button>
						</div>
					</div>

					{#if project.target_amount}
						<div class="mb-3">
							<div class="mb-1 flex items-center justify-between text-sm">
								<span class="text-text-secondary">
									{formatCurrency(project.total_saved)} / {formatCurrency(project.target_amount)}
								</span>
								<span class="font-medium text-accent">{pct.toFixed(0)}%</span>
							</div>
							<div class="h-2 w-full rounded-full bg-bg-hover">
								<div
									class="h-2 rounded-full bg-accent transition-all"
									style="width: {pct}%"
								></div>
							</div>
						</div>
					{/if}

					<!-- Project items -->
					{#if project.items.length > 0}
						<div class="mb-3 space-y-1">
							{#each project.items as item (item.id)}
								<div class="flex items-center justify-between rounded-lg bg-bg-hover px-3 py-2 text-sm">
									<span class="text-text-primary">{item.label}</span>
									<div class="flex items-center gap-2">
										<span class="font-medium text-text-secondary">{formatCurrency(item.planned_amount)}</span>
										<button onclick={() => projectStore.removeItem(item.id)} class="text-text-muted hover:text-danger">
											<X size={14} />
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Add item inline -->
					{#if addingItemToProject === project.id}
						<div class="flex items-center gap-2">
							<input
								bind:value={itemLabel}
								placeholder="Libellé"
								class="flex-1 rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
							/>
							<input
								type="number"
								step="0.01"
								bind:value={itemAmount}
								placeholder="Montant"
								class="w-24 rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
							/>
							<button
								onclick={() => handleAddItem(project.id)}
								class="rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent-hover"
							>
								OK
							</button>
							<button
								onclick={() => (addingItemToProject = null)}
								class="text-text-muted hover:text-text-primary"
							>
								<X size={16} />
							</button>
						</div>
					{:else}
						<button
							onclick={() => { addingItemToProject = project.id; itemLabel = ''; itemAmount = 0; }}
							class="flex items-center gap-1 text-sm text-text-muted hover:text-accent"
						>
							<PlusCircle size={14} />
							Ajouter un élément
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal formulaire -->
{#if showForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={() => (showForm = false)}></div>
		<div class="relative w-full max-w-md rounded-xl border border-border bg-bg-secondary p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-text-primary">
					{editingId ? 'Modifier le projet' : 'Nouveau projet'}
				</h2>
				<button onclick={() => (showForm = false)} class="text-text-muted hover:text-text-primary">
					<X size={20} />
				</button>
			</div>

			<form onsubmit={handleSubmit} class="space-y-4">
				<div>
					<label for="proj-name" class="mb-1 block text-sm font-medium text-text-secondary">Nom *</label>
					<input
						id="proj-name"
						bind:value={formName}
						required
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						placeholder="Vacances d'été"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="proj-target" class="mb-1 block text-sm font-medium text-text-secondary">Montant cible</label>
						<input
							id="proj-target"
							type="number"
							step="0.01"
							bind:value={formTargetAmount}
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
							placeholder="2000"
						/>
					</div>
					<div>
						<label for="proj-date" class="mb-1 block text-sm font-medium text-text-secondary">Date cible</label>
						<input
							id="proj-date"
							type="date"
							bind:value={formTargetDate}
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						/>
					</div>
				</div>

				<div>
					<label for="proj-account" class="mb-1 block text-sm font-medium text-text-secondary">Compte associé</label>
					<select
						id="proj-account"
						bind:value={formAccountId}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
					>
						<option value={null}>Aucun</option>
						{#each accountStore.accounts as account}
							<option value={account.id}>{account.name}</option>
						{/each}
					</select>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<button type="button" onclick={() => (showForm = false)} class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
						Annuler
					</button>
					<button type="submit" class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
						{editingId ? 'Enregistrer' : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
