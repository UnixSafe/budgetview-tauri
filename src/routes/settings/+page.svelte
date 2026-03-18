<script lang="ts">
	import { Settings, Shield, Database, Tag, Info } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Réglages — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary">Réglages</h1>
		<p class="mt-1 text-sm text-text-muted">Configuration de l'application</p>
	</div>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 stagger-children">
		<a href="/settings/rules" class="group glass-card p-6 transition-smooth hover:bg-bg-hover/30 btn-press">
			<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12">
				<Tag size={22} class="text-accent" strokeWidth={1.8} />
			</div>
			<h2 class="text-[15px] font-semibold text-text-primary group-hover:text-accent transition-smooth">Règles de catégorisation</h2>
			<p class="mt-1 text-[13px] text-text-muted">Gérez les règles auto-apprises pour la catégorisation des transactions</p>
		</a>

		<a href="/settings/security" class="group glass-card p-6 transition-smooth hover:bg-bg-hover/30 btn-press">
			<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-income/12">
				<Shield size={22} class="text-income" strokeWidth={1.8} />
			</div>
			<h2 class="text-[15px] font-semibold text-text-primary group-hover:text-income transition-smooth">Sécurité</h2>
			<p class="mt-1 text-[13px] text-text-muted">Mot de passe et protection de l'accès à vos données</p>
		</a>

		<a href="/settings/backup" class="group glass-card p-6 transition-smooth hover:bg-bg-hover/30 btn-press">
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
		</div>
	</div>
</div>
