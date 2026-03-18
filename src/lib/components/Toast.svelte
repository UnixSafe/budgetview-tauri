<script lang="ts">
	import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toast.svelte';

	const typeConfig = {
		success: {
			border: 'border-l-income',
			iconBg: 'bg-income/12',
			iconColor: 'text-income',
			progressColor: 'bg-income',
			Icon: CheckCircle2
		},
		error: {
			border: 'border-l-danger',
			iconBg: 'bg-danger/12',
			iconColor: 'text-danger',
			progressColor: 'bg-danger',
			Icon: AlertTriangle
		},
		info: {
			border: 'border-l-accent',
			iconBg: 'bg-accent/12',
			iconColor: 'text-accent',
			progressColor: 'bg-accent',
			Icon: Info
		}
	} as const;
</script>

{#if toastStore.toasts.length > 0}
	<div class="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
		{#each toastStore.toasts as toast, i (toast.id)}
			{@const config = typeConfig[toast.type] || typeConfig.info}
			<div
				class="toast-enter glass rounded-2xl border-l-[3px] shadow-2xl overflow-hidden {config.border}"
				style="animation-delay: {i * 50}ms"
			>
				<div class="flex items-start gap-3.5 px-5 py-4">
					<!-- Icon -->
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {config.iconBg}">
						<config.Icon size={16} class={config.iconColor} strokeWidth={2} />
					</div>

					<!-- Message -->
					<p class="flex-1 pt-0.5 text-[13.5px] leading-snug font-medium text-text-primary/90">
						{toast.message}
					</p>

					<!-- Dismiss -->
					<button
						onclick={() => toastStore.dismiss(toast.id)}
						class="shrink-0 rounded-full p-1.5 text-text-muted/60 hover:text-text-primary hover:bg-bg-hover transition-smooth"
						aria-label="Fermer"
					>
						<X size={14} strokeWidth={2} />
					</button>
				</div>

				<!-- Progress bar -->
				<div class="h-[2px] w-full bg-glass-border/30">
					<div
						class="h-full {config.progressColor} opacity-40 toast-progress"
						style="animation-duration: {toast.duration}ms"
					></div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	@keyframes toast-slide-in {
		from {
			opacity: 0;
			transform: translateY(12px) translateX(8px) scale(0.96);
			filter: blur(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0) translateX(0) scale(1);
			filter: blur(0);
		}
	}

	.toast-enter {
		animation: toast-slide-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes toast-progress {
		from { width: 100%; }
		to { width: 0%; }
	}

	.toast-progress {
		animation: toast-progress linear forwards;
	}
</style>
