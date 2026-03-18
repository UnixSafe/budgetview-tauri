<script lang="ts">
	import { Lock } from 'lucide-svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface Props {
		onunlock: () => void;
	}

	let { onunlock }: Props = $props();
	let password = $state('');
	let error = $state('');
	let checking = $state(false);

	async function handleSubmit() {
		if (!password) return;
		checking = true;
		error = '';
		try {
			const valid = await invoke<boolean>('verify_app_password', { password });
			if (valid) {
				onunlock();
			} else {
				error = 'Mot de passe incorrect';
				password = '';
			}
		} catch (e) {
			error = String(e);
		} finally {
			checking = false;
		}
	}
</script>

<div class="flex h-screen items-center justify-center bg-bg-primary">
	<div class="w-full max-w-sm rounded-xl border border-border bg-bg-secondary p-8 shadow-xl">
		<div class="mb-6 flex flex-col items-center">
			<div class="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
				<Lock size={32} class="text-accent" />
			</div>
			<h1 class="text-xl font-bold text-text-primary">BudgetView</h1>
			<p class="text-sm text-text-muted">Entrez votre mot de passe</p>
		</div>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="lock-password" class="sr-only">Mot de passe</label>
				<input
					id="lock-password"
					type="password"
					bind:value={password}
					placeholder="Mot de passe"
					autofocus
					class="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-center text-text-primary outline-none focus:border-accent"
				/>
			</div>

			{#if error}
				<p class="text-center text-sm text-expense">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={checking || !password}
				class="w-full rounded-lg bg-accent py-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
			>
				{checking ? 'Vérification...' : 'Déverrouiller'}
			</button>
		</form>
	</div>
</div>
