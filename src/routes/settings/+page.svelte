<script lang="ts">
	import { onMount } from 'svelte';
	import { Settings, Shield, Database, Tag, Info, BarChart3, Keyboard, HardDrive } from 'lucide-svelte';
	import { query } from '$lib/stores/db';

	let stats = $state<{
		accounts: number;
		transactions: number;
		categories: number;
		rules: number;
		projects: number;
		recurring: number;
	}>({ accounts: 0, transactions: 0, categories: 0, rules: 0, projects: 0, recurring: 0 });

	onMount(async () => {
		try {
			const [acc, tx, cat, rules, proj, rec] = await Promise.all([
				query<{ c: number }>('SELECT COUNT(*) as c FROM accounts WHERE is_active = 1'),
				query<{ c: number }>('SELECT COUNT(*) as c FROM transactions'),
				query<{ c: number }>('SELECT COUNT(*) as c FROM budget_series WHERE is_active = 1'),
				query<{ c: number }>('SELECT COUNT(*) as c FROM categorization_rules'),
				query<{ c: number }>('SELECT COUNT(*) as c FROM projects WHERE is_active = 1'),
				query<{ c: number }>('SELECT COUNT(*) as c FROM recurring_transactions WHERE is_active = 1'),
			]);
			stats = {
				accounts: acc[0]?.c ?? 0,
				transactions: tx[0]?.c ?? 0,
				categories: cat[0]?.c ?? 0,
				rules: rules[0]?.c ?? 0,
				projects: proj[0]?.c ?? 0,
				recurring: rec[0]?.c ?? 0,
			};
		} catch { /* tables may not exist */ }
	});
</script>

<svelte:head>
	<title>Réglages — BudgetView</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary">Réglages</h1>
		<p class="mt-1 text-sm text-text-muted">Configuration de l'application</p>
	</div>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 stagger-children">
		<a href="/settings/rules" class="group glass-card p-6 transition-smooth hover:bg-bg-hover/30 btn-press card-hover">
			<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12">
				<Tag size={22} class="text-accent" strokeWidth={1.8} />
			</div>
			<h2 class="text-[15px] font-semibold text-text-primary group-hover:text-accent transition-smooth">Règles de catégorisation</h2>
			<p class="mt-1 text-[13px] text-text-muted">Gérez les règles auto-apprises pour la catégorisation des transactions</p>
			{#if stats.rules > 0}
				<p class="mt-3 text-[11px] font-medium text-accent tabular-nums">{stats.rules} règle{stats.rules > 1 ? 's' : ''} actives</p>
			{/if}
		</a>

		<a href="/settings/security" class="group glass-card p-6 transition-smooth hover:bg-bg-hover/30 btn-press card-hover">
			<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-income/12">
				<Shield size={22} class="text-income" strokeWidth={1.8} />
			</div>
			<h2 class="text-[15px] font-semibold text-text-primary group-hover:text-income transition-smooth">Sécurité</h2>
			<p class="mt-1 text-[13px] text-text-muted">Mot de passe et protection de l'accès à vos données</p>
		</a>

		<a href="/settings/backup" class="group glass-card p-6 transition-smooth hover:bg-bg-hover/30 btn-press card-hover">
			<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/12">
				<Database size={22} class="text-warning" strokeWidth={1.8} />
			</div>
			<h2 class="text-[15px] font-semibold text-text-primary group-hover:text-warning transition-smooth">Sauvegarde</h2>
			<p class="mt-1 text-[13px] text-text-muted">Sauvegardez et restaurez vos données financières</p>
		</a>

		<div class="glass-card p-6">
			<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple/12">
				<Info size={22} class="text-purple" strokeWidth={1.8} />
			</div>
			<h2 class="text-[15px] font-semibold text-text-primary">À propos</h2>
			<p class="mt-1 text-[13px] text-text-muted">BudgetView v0.1.0</p>
			<p class="mt-0.5 text-[12px] text-text-muted">Application de gestion de budget personnel</p>
			<p class="mt-2 text-[12px] text-text-muted">Données stockées localement en SQLite. Aucune connexion internet requise.</p>
			<p class="mt-2 text-[11px] text-text-muted/50">Raccourcis : appuyez sur <kbd class="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] font-mono">?</kbd> pour voir tous les raccourcis clavier</p>
		</div>
	</div>

	<!-- Data statistics -->
	<div class="glass-card p-6">
		<div class="mb-5 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10">
				<HardDrive size={18} class="text-cyan" strokeWidth={1.8} />
			</div>
			<div>
				<h2 class="text-[15px] font-semibold text-text-primary">Statistiques des données</h2>
				<p class="text-[12px] text-text-muted">Aperçu de votre base de données locale</p>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
			<div class="rounded-xl bg-bg-primary/30 px-4 py-3">
				<p class="text-[11px] font-medium text-text-muted uppercase tracking-wider">Comptes</p>
				<p class="mt-1 text-lg font-bold text-text-primary tabular-nums">{stats.accounts}</p>
			</div>
			<div class="rounded-xl bg-bg-primary/30 px-4 py-3">
				<p class="text-[11px] font-medium text-text-muted uppercase tracking-wider">Transactions</p>
				<p class="mt-1 text-lg font-bold text-text-primary tabular-nums">{stats.transactions}</p>
			</div>
			<div class="rounded-xl bg-bg-primary/30 px-4 py-3">
				<p class="text-[11px] font-medium text-text-muted uppercase tracking-wider">Catégories</p>
				<p class="mt-1 text-lg font-bold text-text-primary tabular-nums">{stats.categories}</p>
			</div>
			<div class="rounded-xl bg-bg-primary/30 px-4 py-3">
				<p class="text-[11px] font-medium text-text-muted uppercase tracking-wider">Règles auto</p>
				<p class="mt-1 text-lg font-bold text-text-primary tabular-nums">{stats.rules}</p>
			</div>
			<div class="rounded-xl bg-bg-primary/30 px-4 py-3">
				<p class="text-[11px] font-medium text-text-muted uppercase tracking-wider">Projets</p>
				<p class="mt-1 text-lg font-bold text-text-primary tabular-nums">{stats.projects}</p>
			</div>
			<div class="rounded-xl bg-bg-primary/30 px-4 py-3">
				<p class="text-[11px] font-medium text-text-muted uppercase tracking-wider">Récurrences</p>
				<p class="mt-1 text-lg font-bold text-text-primary tabular-nums">{stats.recurring}</p>
			</div>
		</div>
	</div>
</div>
