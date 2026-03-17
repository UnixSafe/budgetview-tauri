<script lang="ts">
	import { Loader2 } from 'lucide-svelte';
	let { message = 'Chargement...' }: { message?: string } = $props();
</script>

<div class="flex items-center justify-center gap-3 py-12">
	<Loader2 size={24} class="animate-spin text-accent" />
	<span class="text-sm text-text-muted">{message}</span>
</div>
