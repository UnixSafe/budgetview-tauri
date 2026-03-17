<script lang="ts">
	import { BarChart3 } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Analyse — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-text-primary">Analyse</h1>

	<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-12">
		<BarChart3 size={48} class="mb-4 text-text-muted" />
		<p class="text-lg font-medium text-text-secondary">Pas encore de données</p>
		<p class="text-sm text-text-muted">Les graphiques apparaîtront une fois des transactions importées</p>
	</div>
</div>
