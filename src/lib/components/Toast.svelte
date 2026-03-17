<script lang="ts">
	import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
</script>

{#if toastStore.toasts.length > 0}
	<div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
		{#each toastStore.toasts as toast (toast.id)}
			<div
				class="flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-right
					{toast.type === 'success' ? 'border-income/30 bg-income/10 text-income' : ''}
					{toast.type === 'error' ? 'border-danger/30 bg-danger/10 text-danger' : ''}
					{toast.type === 'info' ? 'border-accent/30 bg-accent/10 text-accent' : ''}"
			>
				{#if toast.type === 'success'}
					<CheckCircle2 size={16} />
				{:else if toast.type === 'error'}
					<AlertTriangle size={16} />
				{:else}
					<Info size={16} />
				{/if}
				<span class="text-sm font-medium">{toast.message}</span>
				<button onclick={() => toastStore.dismiss(toast.id)} class="ml-2 opacity-60 hover:opacity-100">
					<X size={14} />
				</button>
			</div>
		{/each}
	</div>
{/if}
