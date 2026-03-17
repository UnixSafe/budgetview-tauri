<script lang="ts">
	import { AlertTriangle, X } from 'lucide-svelte';
	let { message, ondismiss }: { message: string; ondismiss?: () => void } = $props();
</script>

<div class="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
	<AlertTriangle size={20} class="shrink-0 text-danger" />
	<p class="flex-1 text-sm text-danger">{message}</p>
	{#if ondismiss}
		<button onclick={ondismiss} class="text-danger hover:text-danger/70">
			<X size={16} />
		</button>
	{/if}
</div>
