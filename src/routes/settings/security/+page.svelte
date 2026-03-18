<script lang="ts">
	import { onMount } from 'svelte';
	import { Lock, LockOpen, Shield } from 'lucide-svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { toastStore } from '$lib/stores/toast.svelte';

	let hasPassword = $state(false);
	let loading = $state(true);

	// Set password form
	let newPassword = $state('');
	let confirmPassword = $state('');
	let settingPassword = $state(false);

	// Remove password form
	let currentPassword = $state('');
	let removingPassword = $state(false);

	onMount(async () => {
		try {
			hasPassword = await invoke<boolean>('has_app_password');
		} catch {
			hasPassword = false;
		}
		loading = false;
	});

	async function handleSetPassword() {
		if (newPassword.length < 4) {
			toastStore.error('Le mot de passe doit contenir au moins 4 caractères');
			return;
		}
		if (newPassword !== confirmPassword) {
			toastStore.error('Les mots de passe ne correspondent pas');
			return;
		}
		settingPassword = true;
		try {
			await invoke('set_app_password', { password: newPassword });
			hasPassword = true;
			newPassword = '';
			confirmPassword = '';
			toastStore.success('Mot de passe défini');
		} catch (e) {
			toastStore.error(String(e));
		} finally {
			settingPassword = false;
		}
	}

	async function handleRemovePassword() {
		if (!currentPassword) return;
		removingPassword = true;
		try {
			await invoke('remove_app_password', { currentPassword });
			hasPassword = false;
			currentPassword = '';
			toastStore.success('Mot de passe supprimé');
		} catch (e) {
			toastStore.error(String(e));
		} finally {
			removingPassword = false;
		}
	}
</script>

<svelte:head>
	<title>Paramètres — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-text-primary">Paramètres</h1>

	<!-- Password protection section -->
	<div class="rounded-xl border border-border bg-bg-card p-6">
		<div class="mb-4 flex items-center gap-3">
			<div class="rounded-lg bg-accent/10 p-2">
				<Shield size={20} class="text-accent" />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-text-primary">Protection par mot de passe</h2>
				<p class="text-sm text-text-muted">Protégez l'accès à vos données financières</p>
			</div>
		</div>

		{#if loading}
			<p class="text-sm text-text-muted">Chargement...</p>
		{:else if hasPassword}
			<div class="space-y-4">
				<div class="flex items-center gap-2 text-sm text-income">
					<Lock size={16} />
					<span>Mot de passe actif — l'app est protégée au démarrage</span>
				</div>

				<div class="border-t border-border pt-4">
					<p class="mb-2 text-sm font-medium text-text-secondary">Supprimer le mot de passe</p>
					<div class="flex gap-3">
						<input
							type="password"
							bind:value={currentPassword}
							placeholder="Mot de passe actuel"
							class="flex-1 rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
						/>
						<button
							onclick={handleRemovePassword}
							disabled={removingPassword || !currentPassword}
							class="flex items-center gap-2 rounded-lg border border-danger px-4 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
						>
							<LockOpen size={14} />
							{removingPassword ? 'Suppression...' : 'Supprimer'}
						</button>
					</div>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				<div class="flex items-center gap-2 text-sm text-text-muted">
					<LockOpen size={16} />
					<span>Aucun mot de passe — l'app s'ouvre sans protection</span>
				</div>

				<div class="border-t border-border pt-4">
					<p class="mb-2 text-sm font-medium text-text-secondary">Définir un mot de passe</p>
					<form onsubmit={handleSetPassword} class="space-y-3">
						<input
							type="password"
							bind:value={newPassword}
							placeholder="Nouveau mot de passe (4 caractères min.)"
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
						/>
						<input
							type="password"
							bind:value={confirmPassword}
							placeholder="Confirmer le mot de passe"
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
						/>
						<button
							type="submit"
							disabled={settingPassword || newPassword.length < 4}
							class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
						>
							<Lock size={14} />
							{settingPassword ? 'Enregistrement...' : 'Activer la protection'}
						</button>
					</form>
				</div>
			</div>
		{/if}
	</div>
</div>
