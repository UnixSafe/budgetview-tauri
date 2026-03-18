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
	<div class="w-full max-w-sm animate-scale-in">
		<div class="glass-card p-10 shadow-2xl">
			<div class="mb-8 flex flex-col items-center">
				<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 shadow-lg shadow-accent/10">
					<Lock size={36} class="text-accent" strokeWidth={1.8} />
				</div>
				<h1 class="text-2xl font-bold tracking-tight text-text-primary">BudgetView</h1>
				<p class="mt-1 text-sm text-text-muted">Entrez votre mot de passe</p>
			</div>

			<form onsubmit={handleSubmit} class="space-y-5">
				<div>
					<label for="lock-password" class="sr-only">Mot de passe</label>
					<input
						id="lock-password"
						type="password"
						bind:value={password}
						placeholder="Mot de passe"
						autofocus
						class="w-full rounded-xl border border-border bg-bg-primary/80 px-4 py-3.5 text-center text-[15px] text-text-primary outline-none focus-ring placeholder:text-text-muted"
					/>
				</div>

				{#if error}
					<p class="animate-slide-up text-center text-sm font-medium text-danger">{error}</p>
				{/if}

				<button
					type="submit"
					disabled={checking || !password}
					class="w-full rounded-xl bg-accent py-3.5 text-[15px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover disabled:opacity-40"
				>
					{checking ? 'Vérification...' : 'Déverrouiller'}
				</button>
			</form>
		</div>
	</div>
</div>
