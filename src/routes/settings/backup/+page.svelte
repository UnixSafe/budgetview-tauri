<script lang="ts">
	import { Database, Download, Upload, AlertTriangle, CheckCircle2 } from 'lucide-svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { save, open } from '@tauri-apps/plugin-dialog';
	import { toastStore } from '$lib/stores/toast.svelte';

	let exporting = $state(false);
	let importing = $state(false);
	let lastBackupInfo = $state('');

	async function handleBackup() {
		const path = await save({
			defaultPath: `budgetview_backup_${new Date().toISOString().slice(0, 10)}.db`,
			filters: [{ name: 'SQLite Database', extensions: ['db'] }]
		});
		if (!path) return;

		exporting = true;
		try {
			await invoke('backup_database', { destinationPath: path });
			lastBackupInfo = `Sauvegarde créée : ${path}`;
			toastStore.success('Sauvegarde réussie');
		} catch (e) {
			toastStore.error(`Erreur : ${String(e)}`);
		} finally {
			exporting = false;
		}
	}

	async function handleRestore() {
		if (!confirm('Restaurer une sauvegarde écrasera TOUTES vos données actuelles. Continuer ?')) return;

		const filePath = await open({
			multiple: false,
			filters: [{ name: 'SQLite Database', extensions: ['db'] }]
		});
		if (!filePath) return;

		importing = true;
		try {
			await invoke('restore_database', { sourcePath: filePath as string });
			toastStore.success('Restauration réussie. Redémarrez l\'application.');
		} catch (e) {
			toastStore.error(`Erreur : ${String(e)}`);
		} finally {
			importing = false;
		}
	}
</script>

<svelte:head>
	<title>Sauvegarde — BudgetView</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary">Sauvegarde</h1>
		<p class="mt-1 text-sm text-text-muted">Sauvegardez et restaurez vos données</p>
	</div>

	<!-- Backup -->
	<div class="glass-card p-7">
		<div class="mb-6 flex items-center gap-4">
			<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-income/12">
				<Download size={22} class="text-income" strokeWidth={1.8} />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-text-primary">Sauvegarder</h2>
				<p class="text-[13px] text-text-muted">Exportez une copie complète de votre base de données</p>
			</div>
		</div>

		<p class="mb-5 text-[13px] text-text-secondary">
			La sauvegarde contient toutes vos données : comptes, transactions, budget, règles de catégorisation et paramètres.
		</p>

		<button onclick={handleBackup} disabled={exporting}
			class="flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-[14px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20 disabled:opacity-40">
			<Database size={18} />
			{exporting ? 'Sauvegarde en cours...' : 'Créer une sauvegarde'}
		</button>

		{#if lastBackupInfo}
			<div class="mt-4 flex items-center gap-2.5 rounded-xl bg-income/8 px-4 py-3 animate-slide-up">
				<CheckCircle2 size={16} class="text-income" />
				<span class="text-[13px] font-medium text-income">{lastBackupInfo}</span>
			</div>
		{/if}
	</div>

	<!-- Restore -->
	<div class="glass-card p-7">
		<div class="mb-6 flex items-center gap-4">
			<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/12">
				<Upload size={22} class="text-warning" strokeWidth={1.8} />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-text-primary">Restaurer</h2>
				<p class="text-[13px] text-text-muted">Restaurez vos données depuis une sauvegarde</p>
			</div>
		</div>

		<div class="mb-5 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3">
			<AlertTriangle size={16} class="text-warning mt-0.5 shrink-0" />
			<p class="text-[13px] text-warning/80">
				La restauration remplace <strong>toutes</strong> les données actuelles. Cette action est irréversible.
				Il est recommandé de faire une sauvegarde avant de restaurer.
			</p>
		</div>

		<button onclick={handleRestore} disabled={importing}
			class="flex items-center gap-2 rounded-xl border border-warning/50 px-8 py-3.5 text-[14px] font-semibold text-warning transition-smooth btn-press hover:bg-warning/10 disabled:opacity-40">
			<Upload size={18} />
			{importing ? 'Restauration...' : 'Restaurer depuis un fichier'}
		</button>
	</div>
</div>
