<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import LockScreen from '$lib/components/LockScreen.svelte';

	let { children } = $props();
	let locked = $state(false);
	let checkingLock = $state(true);

	onMount(async () => {
		try {
			const hasPassword = await invoke<boolean>('has_app_password');
			locked = hasPassword;
		} catch {
			// If app_settings table doesn't exist yet, no password
			locked = false;
		}
		checkingLock = false;

		// Backfill label_for_categorization for transactions created before migration 003
		invoke('backfill_categorization_labels');
	});
</script>

{#if checkingLock}
	<div class="flex h-screen items-center justify-center bg-bg-primary">
		<div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
	</div>
{:else if locked}
	<LockScreen onunlock={() => (locked = false)} />
{:else}
	<div class="flex h-screen overflow-hidden">
		<Sidebar />
		<main class="flex-1 overflow-y-auto p-6">
			{@render children()}
		</main>
	</div>
{/if}

<Toast />
