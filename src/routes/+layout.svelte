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
			locked = false;
		}
		checkingLock = false;

		// Backfill label_for_categorization for transactions created before migration 003
		invoke('backfill_categorization_labels');
	});
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
			<div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8 animate-fade-in">
				{@render children()}
			</div>
		</main>
	</div>
{/if}

<Toast />
