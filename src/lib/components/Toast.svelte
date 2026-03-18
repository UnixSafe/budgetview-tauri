<script lang="ts">
	import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
</script>

{#if toastStore.toasts.length > 0}
	<div class="fixed bottom-20 md:bottom-6 right-4 z-[100] flex flex-col gap-2">
		{#each toastStore.toasts as toast (toast.id)}
			<div
				class="flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl animate-slide-in-right glass
					{toast.type === 'success' ? 'shadow-income/10' : ''}
					{toast.type === 'error' ? 'shadow-danger/10' : ''}
					{toast.type === 'info' ? 'shadow-accent/10' : ''}"
			>
				{#if toast.type === 'success'}
					<div class="flex h-7 w-7 items-center justify-center rounded-full bg-income/15">
						<CheckCircle2 size={15} class="text-income" />
					</div>
				{:else if toast.type === 'error'}
					<div class="flex h-7 w-7 items-center justify-center rounded-full bg-danger/15">
						<AlertTriangle size={15} class="text-danger" />
					</div>
				{:else}
					<div class="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15">
						<Info size={15} class="text-accent" />
					</div>
				{/if}
				<span class="text-[13px] font-medium text-text-primary">{toast.message}</span>
				<button onclick={() => toastStore.dismiss(toast.id)} class="ml-2 rounded-full p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
					<X size={13} />
				</button>
			</div>
		{/each}
	</div>
{/if}
