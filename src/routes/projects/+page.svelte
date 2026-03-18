<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, FolderKanban, Pencil, Trash2, X, Calendar, PlusCircle, Target } from 'lucide-svelte';
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

	function getDaysRemaining(targetDate: string | null): number | null {
		if (!targetDate) return null;
		const target = new Date(targetDate);
		const today = new Date();
		const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
		return diff;
	}

	function getMonthlyTarget(project: ProjectWithProgress): number | null {
		if (!project.target_amount || !project.target_date) return null;
		const remaining = project.target_amount - project.total_saved;
		if (remaining <= 0) return null;
		const days = getDaysRemaining(project.target_date);
		if (!days || days <= 0) return null;
		const months = Math.max(days / 30, 1);
		return remaining / months;
	}
</script>

<svelte:head>
	<title>Projets — BudgetView</title>
</svelte:head>

<div class="space-y-8 animate-fade-in">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-headline text-text-primary">Projets</h1>
			<p class="mt-1.5 text-body text-text-muted">Planifiez vos objectifs d'épargne</p>
		</div>
		<button onclick={openCreate} class="btn-primary">
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
		<div class="flex flex-col items-center justify-center glass-card p-20 stagger-children">
			<div class="mb-6 flex h-24 w-24 items-center justify-center rounded-[28px] bg-accent/10">
				<Target size={40} class="text-accent" strokeWidth={1.3} />
			</div>
			<p class="text-title text-text-primary">Aucun projet</p>
			<p class="mt-2 text-body text-text-muted max-w-xs text-center">Créez un projet pour planifier et suivre vos objectifs d'épargne</p>
			<button onclick={openCreate} class="btn-primary mt-8">
				<Plus size={16} strokeWidth={2.5} />
				Commencer
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2 stagger-children">
			{#each projectStore.projects as project (project.id)}
				{@const pct = getProgress(project)}
				<div class="glass-card card-hover p-7">
					<!-- Project header -->
					<div class="mb-5 flex items-start justify-between">
						<div class="flex items-start gap-4">
							<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/12">
								<FolderKanban size={22} class="text-accent" strokeWidth={1.5} />
							</div>
							<div>
								<h2 class="text-title text-text-primary">{project.name}</h2>
								{#if project.target_date}
									<p class="flex items-center gap-1.5 text-caption text-text-muted mt-1">
										<Calendar size={12} />
										Objectif : {new Date(project.target_date).toLocaleDateString('fr-FR')}
									</p>
								{/if}
							</div>
						</div>
						<div class="flex gap-1">
							<button onclick={() => openEdit(project)} class="rounded-xl p-2.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
								<Pencil size={14} />
							</button>
							<button onclick={() => { if (confirm('Supprimer ce projet ?')) projectStore.remove(project.id); }} class="rounded-xl p-2.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-smooth">
								<Trash2 size={14} />
							</button>
						</div>
					</div>

					<!-- Countdown & monthly target -->
					{#if project.target_date}
						{@const daysLeft = getDaysRemaining(project.target_date)}
						{@const monthlyNeeded = getMonthlyTarget(project)}
						{#if daysLeft !== null}
							<div class="mb-4 flex items-center gap-3 flex-wrap">
								<span class="badge {daysLeft > 30 ? 'bg-accent/10 text-accent' : daysLeft > 0 ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'}">
									{#if daysLeft > 0}
										{daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}
									{:else if daysLeft === 0}
										Échéance aujourd'hui
									{:else}
										{Math.abs(daysLeft)} jour{Math.abs(daysLeft) > 1 ? 's' : ''} de retard
									{/if}
								</span>
								{#if monthlyNeeded}
									<span class="badge bg-bg-elevated text-text-muted">
										{formatCurrency(monthlyNeeded)} / mois nécessaire
									</span>
								{/if}
							</div>
						{/if}
					{/if}

					<!-- Progress bar -->
					{#if project.target_amount}
						<div class="mb-6">
							<div class="mb-2.5 flex items-center justify-between">
								<span class="text-[13px] text-text-secondary tabular-nums">
									{formatCurrency(project.total_saved)} / {formatCurrency(project.target_amount)}
								</span>
								<span class="text-[14px] font-bold tabular-nums {pct >= 100 ? 'text-income' : 'text-accent'}">{pct.toFixed(0)}%</span>
							</div>
							<div class="h-3 w-full rounded-full bg-bg-elevated/80 overflow-hidden">
								<div
									class="h-full rounded-full progress-bar {pct >= 100 ? 'bg-income' : 'bg-accent'}"
									style="width: {pct}%; background-image: linear-gradient(90deg, {pct >= 100 ? 'var(--color-income)' : 'var(--color-accent)'}, {pct >= 100 ? '#4ade80' : 'var(--color-accent-hover)'});"
								></div>
							</div>
						</div>
					{/if}

					<!-- Items list -->
					{#if project.items.length > 0}
						<div class="mb-5 space-y-2">
							{#each project.items as item (item.id)}
								<div class="flex items-center justify-between rounded-2xl bg-bg-primary/30 px-5 py-3 transition-smooth hover:bg-bg-hover/40">
									<span class="text-[14px] text-text-primary">{item.label}</span>
									<div class="flex items-center gap-3">
										<span class="text-[13px] font-semibold text-text-secondary tabular-nums">{formatCurrency(item.planned_amount)}</span>
										<button onclick={() => { if (confirm('Supprimer ?')) projectStore.removeItem(item.id); }} class="rounded-lg p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-smooth">
											<X size={13} />
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Add item inline -->
					{#if addingItemToProject === project.id}
						<div class="flex items-center gap-2 rounded-2xl bg-bg-primary/20 p-3">
							<input bind:value={itemLabel} placeholder="Libellé"
								class="flex-1 rounded-xl border border-border bg-bg-input px-4 py-3 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
							<input type="number" step="0.01" bind:value={itemAmount} placeholder="Montant"
								class="w-28 rounded-xl border border-border bg-bg-input px-4 py-3 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
							<button onclick={() => handleAddItem(project.id)} class="btn-primary !px-4 !py-3 !text-[13px] !rounded-xl">
								OK
							</button>
							<button onclick={() => (addingItemToProject = null)} class="rounded-xl p-2.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
								<X size={16} />
							</button>
						</div>
					{:else}
						<div class="divider mb-4"></div>
						<button onclick={() => { addingItemToProject = project.id; itemLabel = ''; itemAmount = 0; }}
							class="flex items-center gap-2 text-[13px] font-medium text-text-muted hover:text-accent transition-smooth">
							<PlusCircle size={15} />
							Ajouter un élément
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
		<div class="relative w-full max-w-lg glass-card p-8 shadow-2xl animate-modal-in mx-4">
			<div class="mb-7 flex items-center justify-between">
				<h2 class="text-title text-text-primary">{editingId ? 'Modifier le projet' : 'Nouveau projet'}</h2>
				<button onclick={() => (showForm = false)} class="rounded-xl p-2.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
					<X size={18} />
				</button>
			</div>
			<form onsubmit={handleSubmit} class="space-y-5">
				<div>
					<label for="proj-name" class="mb-2 block text-caption font-medium text-text-secondary">Nom *</label>
					<input id="proj-name" bind:value={formName} required
						class="w-full rounded-2xl border border-border bg-bg-input px-4 py-3.5 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted" placeholder="Vacances d'été" />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="proj-target" class="mb-2 block text-caption font-medium text-text-secondary">Montant cible</label>
						<input id="proj-target" type="number" step="0.01" bind:value={formTargetAmount}
							class="w-full rounded-2xl border border-border bg-bg-input px-4 py-3.5 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted" placeholder="2 000" />
					</div>
					<div>
						<label for="proj-date" class="mb-2 block text-caption font-medium text-text-secondary">Date cible</label>
						<input id="proj-date" type="date" bind:value={formTargetDate}
							class="w-full rounded-2xl border border-border bg-bg-input px-4 py-3.5 text-[14px] text-text-primary outline-none focus-ring" />
					</div>
				</div>
				<div>
					<label for="proj-account" class="mb-2 block text-caption font-medium text-text-secondary">Compte associé</label>
					<select id="proj-account" bind:value={formAccountId}
						class="w-full rounded-2xl border border-border bg-bg-input px-4 py-3.5 text-[14px] text-text-primary outline-none focus-ring">
						<option value="">Aucun</option>
						{#each accountStore.accounts as account}
							<option value={account.id}>{account.name}</option>
						{/each}
					</select>
				</div>
				<div class="divider"></div>
				<div class="flex justify-end gap-3 pt-1">
					<button type="button" onclick={() => (showForm = false)} class="btn-secondary !py-2.5">
						Annuler
					</button>
					<button type="submit" class="btn-primary !py-2.5">
						{editingId ? 'Enregistrer' : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
