<script lang="ts">
	import { AlertTriangle, X } from 'lucide-svelte';
	let { message, ondismiss }: { message: string; ondismiss?: () => void } = $props();
</script>

<div class="flex items-center gap-3 rounded-2xl border border-danger/20 bg-danger/8 px-5 py-4 animate-slide-up">
	<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/15">
		<AlertTriangle size={16} class="text-danger" />
	</div>
	<p class="flex-1 text-[13px] font-medium text-danger/90">{message}</p>
	{#if ondismiss}
		<button onclick={ondismiss} class="rounded-full p-1.5 text-danger/50 hover:text-danger hover:bg-danger/10 transition-smooth">
			<X size={15} />
		</button>
	{/if}
</div>
