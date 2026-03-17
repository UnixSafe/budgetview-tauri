<script lang="ts">
	import { Plus, FolderKanban } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Projets — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-text-primary">Projets</h1>
		<button
			class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
		>
			<Plus size={16} />
			Nouveau projet
		</button>
	</div>

	<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-12">
		<FolderKanban size={48} class="mb-4 text-text-muted" />
		<p class="text-lg font-medium text-text-secondary">Aucun projet</p>
		<p class="text-sm text-text-muted">Créez un projet pour planifier vos objectifs d'épargne</p>
	</div>
</div>
