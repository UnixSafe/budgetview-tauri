<script lang="ts">
	import { Lock, Eye, EyeOff } from 'lucide-svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface Props {
		onunlock: () => void;
	}

	let { onunlock }: Props = $props();
	let password = $state('');
	let error = $state('');
	let checking = $state(false);
	let showPassword = $state(false);

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

<div class="lock-screen fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-bg-primary">
	<!-- Ambient background glow -->
	<div class="pointer-events-none absolute inset-0">
		<div class="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.04] blur-[120px]"></div>
		<div class="absolute bottom-1/4 left-1/3 h-[300px] w-[300px] rounded-full bg-purple/[0.03] blur-[100px]"></div>
		<div class="absolute right-1/3 top-2/3 h-[250px] w-[250px] rounded-full bg-cyan/[0.03] blur-[80px]"></div>
	</div>

	<!-- Content -->
	<div class="relative w-full max-w-[380px] px-6 animate-scale-in">
		<div class="glass-card p-10 shadow-2xl shadow-black/30">
			<!-- Lock icon with glow -->
			<div class="mb-9 flex flex-col items-center">
				<div class="lock-icon-wrapper relative mb-6">
					<!-- Glow behind icon -->
					<div class="absolute inset-0 rounded-[22px] bg-accent/15 blur-xl animate-pulse-glow"></div>
					<div class="relative flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-gradient-to-br from-accent/20 via-accent/10 to-transparent border border-accent/10 shadow-lg shadow-accent/10">
						<Lock size={32} class="text-accent/90" strokeWidth={1.6} />
					</div>
				</div>

				<h1 class="text-[22px] font-bold tracking-tight text-text-primary">BudgetView</h1>
				<p class="mt-1.5 text-[13.5px] text-text-muted">Entrez votre mot de passe</p>
			</div>

			<form onsubmit={handleSubmit} class="space-y-5">
				<!-- Password field -->
				<div class="relative">
					<label for="lock-password" class="sr-only">Mot de passe</label>
					<input
						id="lock-password"
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						placeholder="Mot de passe"
						autofocus
						class="w-full rounded-2xl border border-border/60 bg-bg-input px-5 py-3.5 pr-12 text-center text-[15px] tracking-wide text-text-primary outline-none placeholder:text-text-muted/70 focus-ring"
					/>
					<button
						type="button"
						onclick={() => showPassword = !showPassword}
						class="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted/50 hover:text-text-secondary transition-smooth"
						aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
						tabindex={-1}
					>
						{#if showPassword}
							<EyeOff size={16} strokeWidth={1.8} />
						{:else}
							<Eye size={16} strokeWidth={1.8} />
						{/if}
					</button>
				</div>

				<!-- Error message -->
				{#if error}
					<p class="animate-slide-up text-center text-[13px] font-medium text-danger">{error}</p>
				{/if}

				<!-- Submit button -->
				<button
					type="submit"
					disabled={checking || !password}
					class="btn-unlock w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white btn-press disabled:opacity-30 disabled:cursor-not-allowed"
				>
					{#if checking}
						<span class="flex items-center justify-center gap-2">
							<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
							Verification...
						</span>
					{:else}
						Deverrouiller
					{/if}
				</button>
			</form>
		</div>

		<!-- Subtle branding -->
		<p class="mt-6 text-center text-[11px] font-medium tracking-widest text-text-muted/30 uppercase">
			Donnees protegees localement
		</p>
	</div>
</div>

<style>
	.btn-unlock {
		transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
		box-shadow: 0 4px 20px rgba(10, 132, 255, 0.2);
	}

	.btn-unlock:not(:disabled):hover {
		background: var(--color-accent-hover);
		box-shadow: 0 6px 28px rgba(10, 132, 255, 0.3);
		transform: translateY(-1px);
	}

	.lock-screen {
		animation: lock-fade-in 0.6s cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes lock-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
