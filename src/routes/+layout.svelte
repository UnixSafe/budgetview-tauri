<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();

	onMount(() => {
		// Backfill label_for_categorization for transactions created before migration 003
		// Uses Rust-side anonymization for speed and consistency
		invoke('backfill_categorization_labels');
	});
</script>

<div class="flex h-screen overflow-hidden">
	<Sidebar />
	<main class="flex-1 overflow-y-auto p-6">
		{@render children()}
	</main>
</div>

<Toast />
