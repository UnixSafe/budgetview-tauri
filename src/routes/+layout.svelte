<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import LockScreen from '$lib/components/LockScreen.svelte';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import PageTransition from '$lib/components/PageTransition.svelte';
	import GlobalSearch from '$lib/components/GlobalSearch.svelte';
	import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
	import { query } from '$lib/stores/db';

	let { children } = $props();
	let locked = $state(false);
	let checkingLock = $state(true);
	let showOnboarding = $state(false);

	onMount(async () => {
		try {
			const hasPassword = await invoke<boolean>('has_app_password');
			locked = hasPassword;
		} catch {
			locked = false;
		}
		checkingLock = false;

		// Backfill label_for_categorization for transactions created before migration 003
		invoke('backfill_categorization_labels');

		// Check if this is first launch (no accounts = new user)
		if (!locked) {
			try {
				const result = await query<{ count: number }>('SELECT COUNT(*) as count FROM accounts');
				const onboarded = await query<{ value: string }>('SELECT value FROM app_settings WHERE key = $1', ['onboarded']);
				if ((result[0]?.count ?? 0) === 0 && !onboarded[0]) {
					showOnboarding = true;
				}
			} catch { /* ignore */ }
		}
	});

	async function handleOnboardingClose() {
		showOnboarding = false;
		try {
			await query('INSERT OR REPLACE INTO app_settings (key, value) VALUES ($1, $2)', ['onboarded', '1']);
		} catch { /* ignore */ }
	}
</script>

{#if checkingLock}
	<div class="flex h-screen items-center justify-center bg-bg-primary">
		<div class="h-10 w-10 animate-spin rounded-full border-[3px] border-accent/20 border-t-accent"></div>
	</div>
{:else if locked}
	<LockScreen onunlock={() => (locked = false)} />
{:else}
	<div class="flex h-screen overflow-hidden bg-bg-primary">
		<Sidebar />
		<main class="flex-1 overflow-y-auto pb-20 md:pb-0">
			<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
				<PageTransition>
					{@render children()}
				</PageTransition>
			</div>
		</main>
	</div>
{/if}

{#if showOnboarding}
	<OnboardingModal onclose={handleOnboardingClose} />
{/if}

<Toast />
<GlobalSearch />
<KeyboardShortcuts />
