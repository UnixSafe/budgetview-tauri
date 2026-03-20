<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2, FolderOpen, ChevronDown, ChevronUp, ArrowRightLeft, TrendingUp, TrendingDown, Copy, Coins, RefreshCw, ShoppingCart, Sparkles, Landmark, ArrowLeftRight } from 'lucide-svelte';
	import { budgetStore } from '$lib/stores/budget.svelte';
	import { formatCurrency, formatMonth, toEuros, BUDGET_AREA_LABELS } from '$lib/utils/format';
	import { confidentialStore } from '$lib/stores/confidential.svelte';
	import type { BudgetArea, BudgetLineItem } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';

	let showSeriesForm = $state(false);
	let editingSeriesId = $state<number | null>(null);
	let formName = $state('');
	let formArea = $state<BudgetArea>('variable');
	let formTarget = $state<number>(0);
	let formDescription = $state('');
	let formGroupId = $state<number | string>('');

	let newSubSeriesName = $state('');
	let editingBudgetId = $state<number | null>(null);
	let editingBudgetAmount = $state(0);

	// Group management
	let showGroupForm = $state(false);
	let newGroupName = $state('');

	onMount(async () => {
		await budgetStore.loadBudgetView();
		await budgetStore.loadPrevMonthComparison();
	});

	function prevMonth() {
		if (budgetStore.month === 1) {
			budgetStore.month = 12;
			budgetStore.year--;
		} else {
			budgetStore.month--;
		}
		budgetStore.loadBudgetView();
		budgetStore.loadPrevMonthComparison();
	}

	function nextMonth() {
		if (budgetStore.month === 12) {
			budgetStore.month = 1;
			budgetStore.year++;
		} else {
			budgetStore.month++;
		}
		budgetStore.loadBudgetView();
		budgetStore.loadPrevMonthComparison();
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
		formGroupId = s.group_id ?? '';
		showSeriesForm = true;
	}

	async function handleSeriesSubmit() {
		if (!formName.trim()) return;
		const groupId = formGroupId === '' ? null : Number(formGroupId);
		if (editingSeriesId) {
			await budgetStore.updateSeries(editingSeriesId, {
				name: formName,
				budget_area: formArea,
				target_amount: formTarget || null,
				description: formDescription || null
			});
			await budgetStore.assignSeriesToGroup(editingSeriesId, groupId);
		} else {
			await budgetStore.createSeries({
				name: formName,
				budget_area: formArea,
				target_amount: formTarget || undefined,
				description: formDescription || undefined
			});
		}
		toastStore.success(editingSeriesId ? 'Catégorie modifiée' : 'Catégorie créée');
		showSeriesForm = false;
	}

	async function handleCreateGroup() {
		if (!newGroupName.trim()) return;
		await budgetStore.createGroup(newGroupName.trim());
		toastStore.success('Groupe créé');
		newGroupName = '';
		showGroupForm = false;
	}

	async function handleDeleteGroup(id: number) {
		if (!confirm('Supprimer ce groupe ? Les catégories ne seront pas supprimées.')) return;
		await budgetStore.removeGroup(id);
		toastStore.success('Groupe supprimé');
	}

	async function handleCarryOver(seriesId: number) {
		await budgetStore.calculateCarryOver(seriesId);
		toastStore.success('Report calculé');
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
		if (line.budget_area === 'income') {
			return Math.min((line.actual_amount / line.planned_amount) * 100, 100);
		}
		return Math.min((Math.abs(line.actual_amount) / Math.abs(line.planned_amount)) * 100, 150);
	}

	function progressColor(line: BudgetLineItem): string {
		const pct = progressPercent(line);
		if (line.budget_area === 'income') {
			return pct >= 100 ? 'bg-income' : 'bg-income/60';
		}
		if (pct > 100) return 'bg-danger';
		if (pct > 80) return 'bg-warning';
		return 'bg-accent';
	}

	const budgetAreas: BudgetArea[] = ['income', 'recurring', 'variable', 'extras', 'savings', 'transfers'];

	const AREA_ICONS = {
		income: Coins,
		recurring: RefreshCw,
		variable: ShoppingCart,
		extras: Sparkles,
		savings: Landmark,
		transfers: ArrowLeftRight
	} as Record<string, typeof Coins>;

	const AREA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
		income: { bg: 'bg-income/10', text: 'text-income', border: 'border-l-income' },
		recurring: { bg: 'bg-accent/10', text: 'text-accent', border: 'border-l-accent' },
		variable: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-l-warning' },
		extras: { bg: 'bg-purple/10', text: 'text-purple', border: 'border-l-purple' },
		savings: { bg: 'bg-cyan/10', text: 'text-cyan', border: 'border-l-cyan' },
		transfers: { bg: 'bg-text-muted/10', text: 'text-text-muted', border: 'border-l-text-muted' },
	};
</script>

<svelte:head>
	<title>Budget — BudgetView</title>
</svelte:head>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Budget</h1>
			<p class="mt-1 text-sm text-text-muted">Planifiez et suivez vos dépenses</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={async () => {
					const count = await budgetStore.copyFromPreviousMonth();
					if (count > 0) toastStore.success(`${count} budget(s) copié(s) du mois précédent`);
					else toastStore.show('Aucun budget à copier');
				}}
				class="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13px] font-medium text-text-secondary transition-smooth btn-press hover:bg-bg-hover hover:text-text-primary"
				title="Copier les montants budgétés du mois précédent"
			>
				<Copy size={15} />
				Copier
			</button>
			<button
				onclick={openCreateSeries}
				class="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20"
			>
				<Plus size={16} strokeWidth={2.5} />
				Nouvelle catégorie
			</button>
		</div>
	</div>

	<!-- Month navigation -->
	<div class="flex items-center justify-center gap-6">
		<button onclick={prevMonth} class="rounded-xl p-2.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-smooth btn-press">
			<ChevronLeft size={22} />
		</button>
		<span class="text-xl font-bold text-text-primary capitalize min-w-[200px] text-center">
			{formatMonth(budgetStore.year, budgetStore.month)}
		</span>
		<button onclick={nextMonth} class="rounded-xl p-2.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-smooth btn-press">
			<ChevronRight size={22} />
		</button>
	</div>

	{#if budgetStore.error}
		<ErrorBanner message={budgetStore.error} ondismiss={() => (budgetStore.error = null)} />
	{/if}

	{#if budgetStore.loading}
		<LoadingSpinner message="Chargement du budget..." />
	{:else if budgetStore.budgetLines.length === 0}
		<div class="flex flex-col items-center justify-center glass-card p-16">
			<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10">
				<Coins size={36} class="text-accent" strokeWidth={1.3} />
			</div>
			<p class="text-xl font-semibold text-text-primary">Aucune catégorie</p>
			<p class="mt-1 text-sm text-text-muted">Créez des catégories pour planifier votre budget mensuel</p>
			<button
				onclick={openCreateSeries}
				class="mt-6 flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-smooth btn-press hover:bg-accent-hover"
			>
				<Plus size={16} />
				Commencer
			</button>
		</div>
	{:else}
		<!-- Summary -->
		{@const remaining = budgetStore.totalPlanned - budgetStore.totalActual}
		{@const now = new Date()}
		{@const daysInMonth = new Date(budgetStore.year, budgetStore.month, 0).getDate()}
		{@const daysLeft = Math.max(daysInMonth - now.getDate() + 1, 1)}
		{@const isCurrentMonth = budgetStore.year === now.getFullYear() && budgetStore.month === now.getMonth() + 1}
		{@const dailyBudget = remaining / daysLeft}
		<div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 stagger-children">
			<div class="glass-card p-5 text-center">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Planifié</p>
				<p class="mt-2 text-2xl font-bold tracking-tight text-text-primary">{confidentialStore.format(budgetStore.totalPlanned)}</p>
			</div>
			<div class="glass-card p-5 text-center">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Réalisé</p>
				<p class="mt-2 text-2xl font-bold tracking-tight text-text-primary">{confidentialStore.format(budgetStore.totalActual)}</p>
			</div>
			<div class="glass-card p-5 text-center">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Reste</p>
				<p class="mt-2 text-2xl font-bold tracking-tight {remaining >= 0 ? 'text-income' : 'text-expense'}">
					{confidentialStore.format(remaining)}
				</p>
			</div>
			{#if isCurrentMonth}
				<div class="glass-card p-5 text-center">
					<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Par jour</p>
					<p class="mt-2 text-2xl font-bold tracking-tight {dailyBudget >= 0 ? 'text-income' : 'text-expense'}">
						{confidentialStore.format(dailyBudget)}
					</p>
					<p class="text-[10px] text-text-muted mt-1">{daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</p>
				</div>
			{/if}
		</div>

		<!-- Groups management -->
		{#if budgetStore.groups.length > 0}
			<div class="flex items-center gap-2 flex-wrap">
				{#each budgetStore.groups as group (group.id)}
					<div class="flex items-center gap-1.5 rounded-xl bg-bg-card/60 border border-border-light px-3 py-1.5">
						<FolderOpen size={13} class="text-accent" />
						<span class="text-[12px] font-medium text-text-primary">{group.name}</span>
						<button onclick={() => handleDeleteGroup(group.id)} class="ml-1 text-text-muted hover:text-danger transition-smooth">
							<X size={12} />
						</button>
					</div>
				{/each}
				{#if !showGroupForm}
					<button onclick={() => (showGroupForm = true)} class="rounded-xl border border-dashed border-border px-3 py-1.5 text-[12px] text-text-muted hover:text-text-primary hover:border-accent transition-smooth">
						<Plus size={12} class="inline" /> Groupe
					</button>
				{/if}
			</div>
		{:else}
			<button onclick={() => (showGroupForm = true)} class="text-[12px] text-text-muted hover:text-accent transition-smooth">
				<FolderOpen size={12} class="inline" /> Créer un groupe de catégories
			</button>
		{/if}

		{#if showGroupForm}
			<div class="flex items-center gap-2">
				<input bind:value={newGroupName} placeholder="Nom du groupe"
					class="rounded-xl border border-border bg-bg-primary/60 px-4 py-2 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted"
					onkeydown={(e) => e.key === 'Enter' && handleCreateGroup()}
				/>
				<button onclick={handleCreateGroup} class="rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover">
					Créer
				</button>
				<button onclick={() => { showGroupForm = false; newGroupName = ''; }} class="rounded-xl px-3 py-2 text-[12px] text-text-muted hover:text-text-primary transition-smooth">
					Annuler
				</button>
			</div>
		{/if}

		<!-- Budget by area -->
		<div class="space-y-6 stagger-children">
			{#each budgetAreas as area}
				{@const lines = budgetStore.groupedByArea[area]}
				{#if lines.length > 0}
					{@const areaStyle = AREA_COLORS[area] ?? { bg: 'bg-accent/10', text: 'text-accent', border: '' }}
					{@const areaTotal = lines.reduce((s, l) => s + Math.abs(l.actual_amount), 0)}
					{@const areaPlanned = lines.reduce((s, l) => s + Math.abs(l.planned_amount), 0)}
					<div class="glass-card overflow-hidden">
						<div class="flex items-center gap-3 border-b border-border-light px-6 py-4">
							{#if AREA_ICONS[area]}
								{@const Icon = AREA_ICONS[area]}
								<div class="flex h-7 w-7 items-center justify-center rounded-lg {areaStyle.bg}">
									<Icon size={15} class={areaStyle.text} strokeWidth={1.8} />
								</div>
							{/if}
							<h3 class="text-[13px] font-bold text-text-secondary uppercase tracking-wider">
								{BUDGET_AREA_LABELS[area]}
							</h3>
							<div class="ml-auto flex items-center gap-3 text-[12px] tabular-nums text-text-muted">
								<span>{confidentialStore.format(areaTotal * (area === 'income' ? 1 : -1))}</span>
								{#if areaPlanned > 0}
									<span class="text-text-muted/40">/</span>
									<span>{confidentialStore.format(areaPlanned * (area === 'income' ? 1 : -1))}</span>
								{/if}
							</div>
						</div>
						<div class="divide-y divide-border-light/50">
							{#each lines as line (line.series_id)}
								{@const carry = budgetStore.getCarryOver(line.series_id)}
								{@const series = budgetStore.series.find(s => s.id === line.series_id)}
								{@const groupName = series?.group_id ? budgetStore.groups.find(g => g.id === series.group_id)?.name : null}
								{@const prevActual = budgetStore.getPrevMonthActual(line.series_id)}
								{@const diff = prevActual !== 0 ? Math.abs(line.actual_amount) - Math.abs(prevActual) : 0}
								<div class="px-6 py-4 hover-row transition-smooth">
									<div class="flex items-center justify-between mb-3">
										<div class="flex items-center gap-2">
											<span class="text-[14px] font-semibold text-text-primary">{line.series_name}</span>
											{#if groupName}
												<span class="badge bg-accent/10 text-accent">{groupName}</span>
											{/if}
											{#if carry !== 0}
												<span class="badge {carry > 0 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}">
													Report: {confidentialStore.format(carry)}
												</span>
											{/if}
											<button onclick={() => openEditSeries(line)} class="rounded-lg p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth opacity-0 group-hover:opacity-100" style="opacity: 1;">
												<Pencil size={12} />
											</button>
											<button onclick={() => handleCarryOver(line.series_id)} class="rounded-lg p-1 text-text-muted hover:text-accent hover:bg-accent/10 transition-smooth" title="Calculer le report du mois précédent">
												<ArrowRightLeft size={12} />
											</button>
										</div>
										<div class="flex items-center gap-4 text-[13px]">
											{#if editingBudgetId === line.series_id}
												<input
													type="number"
													step="0.01"
													bind:value={editingBudgetAmount}
													onkeydown={(e) => e.key === 'Enter' && saveBudget(line.series_id)}
													onblur={() => saveBudget(line.series_id)}
													class="w-28 rounded-lg border border-accent bg-bg-primary/60 px-3 py-1.5 text-right text-[13px] text-text-primary outline-none focus-ring"
												/>
											{:else}
												<button
													onclick={() => startEditBudget(line)}
													class="tabular-nums transition-smooth font-medium {line.planned_amount === 0 ? 'text-text-muted/40 hover:text-accent border border-dashed border-text-muted/20 hover:border-accent/40 rounded-lg px-2 py-0.5' : 'text-text-secondary hover:text-accent'}"
													title="Cliquer pour définir le budget"
												>
													{#if line.planned_amount === 0}
														<span class="text-[11px]">Définir</span>
													{:else}
														{confidentialStore.format(line.planned_amount)}
													{/if}
												</button>
											{/if}
											<span class="text-text-muted">/</span>
											<span class="tabular-nums font-semibold {Math.abs(line.actual_amount) > Math.abs(line.planned_amount) && line.budget_area !== 'income' ? 'text-expense' : 'text-text-primary'}">
												{confidentialStore.format(line.actual_amount)}
											</span>
											{#if diff !== 0 && prevActual !== 0}
												<span class="flex items-center gap-0.5 text-[10px] font-medium {line.budget_area === 'income' ? (diff > 0 ? 'text-income' : 'text-expense') : (diff > 0 ? 'text-expense' : 'text-income')}" title="Vs mois précédent">
													{#if diff > 0}
														<TrendingUp size={10} />+{Math.round(Math.abs(diff / prevActual) * 100)}%
													{:else}
														<TrendingDown size={10} />-{Math.round(Math.abs(diff / prevActual) * 100)}%
													{/if}
												</span>
											{/if}
										</div>
									</div>
									<div class="h-[6px] w-full rounded-full bg-bg-elevated overflow-hidden">
										{#if line.planned_amount === 0 && line.actual_amount !== 0}
											<div class="h-full w-full rounded-full bg-warning/30" style="background-image: repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,214,10,0.25) 4px, rgba(255,214,10,0.25) 8px);"></div>
										{:else}
											<div
												class="h-full rounded-full progress-bar {progressColor(line)}"
												style="width: {Math.min(progressPercent(line), 100)}%"
											></div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<!-- Modal series -->
{#if showSeriesForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={() => (showSeriesForm = false)}></div>
		<div class="relative w-full max-w-md glass-card p-7 shadow-2xl animate-modal-in mx-4">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-bold tracking-tight text-text-primary">
					{editingSeriesId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
				</h2>
				<button onclick={() => (showSeriesForm = false)} class="rounded-xl p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
					<X size={18} />
				</button>
			</div>

			<form onsubmit={handleSeriesSubmit} class="space-y-5">
				<div>
					<label for="series-name" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Nom *</label>
					<input id="series-name" bind:value={formName} required
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted"
						placeholder="Courses alimentaires" />
				</div>

				<div>
					<label for="series-area" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Zone budget *</label>
					<select id="series-area" bind:value={formArea}
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring">
						{#each Object.entries(BUDGET_AREA_LABELS) as [value, label]}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="series-target" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Montant cible mensuel</label>
					<input id="series-target" type="number" step="0.01" bind:value={formTarget}
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring" />
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="series-desc" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Description</label>
						<input id="series-desc" bind:value={formDescription}
							class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted"
							placeholder="Description optionnelle" />
					</div>
					<div>
						<label for="series-group" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Groupe</label>
						<select id="series-group" bind:value={formGroupId}
							class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring">
							<option value="">Aucun groupe</option>
							{#each budgetStore.groups as group}
								<option value={group.id}>{group.name}</option>
							{/each}
						</select>
					</div>
				</div>

				{#if editingSeriesId}
					<div class="border-t border-border-light pt-5">
						<p class="mb-3 text-[13px] font-semibold text-text-secondary">Sous-catégories</p>
						<div class="space-y-1.5">
							{#each budgetStore.getSubSeries(editingSeriesId) as sub (sub.id)}
								<div class="flex items-center justify-between rounded-xl bg-bg-primary/40 px-4 py-2.5">
									<span class="text-[13px] text-text-primary">{sub.name}</span>
									<button
										type="button"
										onclick={async () => { if (confirm(`Supprimer "${sub.name}" ?`)) await budgetStore.removeSubSeries(sub.id); }}
										class="text-text-muted hover:text-danger transition-smooth"
										aria-label="Supprimer la sous-catégorie {sub.name}"
									>
										<Trash2 size={13} />
									</button>
								</div>
							{/each}
						</div>
						<div class="mt-3 flex gap-2">
							<input
								bind:value={newSubSeriesName}
								placeholder="Nouvelle sous-catégorie"
								class="flex-1 rounded-xl border border-border bg-bg-primary/60 px-4 py-2.5 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted"
								onkeydown={async (e) => {
									if (e.key === 'Enter' && newSubSeriesName.trim() && editingSeriesId) {
										e.preventDefault();
										await budgetStore.createSubSeries(editingSeriesId, newSubSeriesName.trim());
										newSubSeriesName = '';
									}
								}}
							/>
							<button
								type="button"
								onclick={async () => {
									if (newSubSeriesName.trim() && editingSeriesId) {
										await budgetStore.createSubSeries(editingSeriesId, newSubSeriesName.trim());
										newSubSeriesName = '';
									}
								}}
								class="rounded-xl bg-bg-hover px-4 py-2.5 text-text-secondary hover:text-text-primary transition-smooth"
							>
								<Plus size={15} />
							</button>
						</div>
					</div>
				{/if}

				<div class="flex justify-end gap-3 pt-3">
					<button type="button" onclick={() => (showSeriesForm = false)} class="rounded-xl px-5 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-smooth">
						Annuler
					</button>
					{#if editingSeriesId}
						<button
							type="button"
							onclick={async () => { if (confirm('Supprimer cette catégorie ?')) { await budgetStore.removeSeries(editingSeriesId!); showSeriesForm = false; } }}
							class="rounded-xl px-5 py-2.5 text-[13px] font-medium text-danger hover:bg-danger/10 transition-smooth"
						>
							Supprimer
						</button>
					{/if}
					<button type="submit" class="rounded-xl bg-accent px-6 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20">
						{editingSeriesId ? 'Enregistrer' : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
