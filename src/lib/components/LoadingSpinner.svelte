<script lang="ts">
	let { message = 'Chargement...' }: { message?: string } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-4 py-16 animate-fade-in">
	<div class="relative h-10 w-10">
		<div class="absolute inset-0 rounded-full border-[3px] border-accent/10"></div>
		<div class="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-accent"></div>
	</div>
	<span class="text-sm font-medium text-text-muted">{message}</span>
</div>
