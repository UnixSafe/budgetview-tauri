<script lang="ts">
	import { onMount } from 'svelte';
	import { Lock, LockOpen, Shield } from 'lucide-svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { toastStore } from '$lib/stores/toast.svelte';

	let hasPassword = $state(false);
	let loading = $state(true);

	let newPassword = $state('');
	let confirmPassword = $state('');
	let settingPassword = $state(false);

	let currentPassword = $state('');
	let removingPassword = $state(false);

	onMount(async () => {
		try { hasPassword = await invoke<boolean>('has_app_password'); }
		catch { hasPassword = false; }
		loading = false;
	});

	async function handleSetPassword() {
		if (newPassword.length < 4) { toastStore.error('Minimum 4 caractères'); return; }
		if (newPassword !== confirmPassword) { toastStore.error('Les mots de passe ne correspondent pas'); return; }
		settingPassword = true;
		try {
			await invoke('set_app_password', { password: newPassword });
			hasPassword = true; newPassword = ''; confirmPassword = '';
			toastStore.success('Mot de passe défini');
		} catch (e) { toastStore.error(String(e)); }
		finally { settingPassword = false; }
	}

	async function handleRemovePassword() {
		if (!currentPassword) return;
		removingPassword = true;
		try {
			await invoke('remove_app_password', { currentPassword });
			hasPassword = false; currentPassword = '';
			toastStore.success('Mot de passe supprimé');
		} catch (e) { toastStore.error(String(e)); }
		finally { removingPassword = false; }
	}
</script>

<svelte:head>
	<title>Sécurité — BudgetView</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary">Sécurité</h1>
		<p class="mt-1 text-sm text-text-muted">Protégez l'accès à vos données</p>
	</div>

	<div class="glass-card p-7">
		<div class="mb-6 flex items-center gap-4">
			<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12">
				<Shield size={22} class="text-accent" strokeWidth={1.8} />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-text-primary">Mot de passe</h2>
				<p class="text-[13px] text-text-muted">Vérification au lancement de l'application</p>
			</div>
		</div>

		{#if loading}
			<div class="flex items-center gap-3 py-4">
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-accent/20 border-t-accent"></div>
				<span class="text-[13px] text-text-muted">Chargement...</span>
			</div>
		{:else if hasPassword}
			<div class="space-y-6">
				<div class="flex items-center gap-2.5 rounded-xl bg-income/8 px-4 py-3">
					<Lock size={16} class="text-income" />
					<span class="text-[13px] font-medium text-income">Protection active</span>
				</div>

				<div class="border-t border-border-light pt-6">
					<label for="security-current-password" class="mb-3 block text-[13px] font-semibold text-text-secondary">Supprimer le mot de passe</label>
					<div class="flex gap-3">
						<input id="security-current-password" type="password" bind:value={currentPassword} placeholder="Mot de passe actuel"
							class="flex-1 rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
						<button onclick={handleRemovePassword} disabled={removingPassword || !currentPassword}
							class="flex items-center gap-2 rounded-xl border border-danger/50 px-5 py-3 text-[13px] font-medium text-danger transition-smooth btn-press hover:bg-danger/10 disabled:opacity-40">
							<LockOpen size={15} />
							{removingPassword ? 'Suppression...' : 'Supprimer'}
						</button>
					</div>
				</div>
			</div>
		{:else}
			<div class="space-y-6">
				<div class="flex items-center gap-2.5 rounded-xl bg-bg-elevated px-4 py-3">
					<LockOpen size={16} class="text-text-muted" />
					<span class="text-[13px] text-text-muted">Aucune protection</span>
				</div>

				<div class="border-t border-border-light pt-6">
					<p class="mb-3 text-[13px] font-semibold text-text-secondary">Définir un mot de passe</p>
					<form onsubmit={handleSetPassword} class="space-y-4">
						<div>
							<label for="security-new-password" class="mb-1.5 block text-[12px] font-medium text-text-muted">Nouveau mot de passe</label>
							<input id="security-new-password" type="password" bind:value={newPassword} placeholder="4 caractères minimum"
								class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
						</div>
						<div>
							<label for="security-confirm-password" class="mb-1.5 block text-[12px] font-medium text-text-muted">Confirmer</label>
							<input id="security-confirm-password" type="password" bind:value={confirmPassword} placeholder="Confirmer le mot de passe"
								class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring placeholder:text-text-muted" />
						</div>
						<button type="submit" disabled={settingPassword || newPassword.length < 4}
							class="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-[14px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20 disabled:opacity-40">
							<Lock size={15} />
							{settingPassword ? 'Enregistrement...' : 'Activer la protection'}
						</button>
					</form>
				</div>
			</div>
		{/if}
	</div>
</div>
