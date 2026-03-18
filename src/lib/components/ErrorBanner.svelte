<script lang="ts">
	import { AlertTriangle, X } from 'lucide-svelte';

	interface Props {
		message: string;
		ondismiss?: () => void;
	}

	let { message, ondismiss }: Props = $props();
	let dismissed = $state(false);

	function handleDismiss() {
		dismissed = true;
		setTimeout(() => {
			ondismiss?.();
		}, 300);
	}
</script>

{#if !dismissed}
	<div
		class="error-banner glass-card-sm flex items-start gap-3.5 border-l-[3px] border-l-danger px-5 py-4"
		class:error-banner-out={dismissed}
	>
		<!-- Icon -->
		<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10">
			<AlertTriangle size={17} class="text-danger" strokeWidth={2} />
		</div>

		<!-- Message -->
		<div class="flex-1 pt-0.5">
			<p class="text-[13.5px] leading-relaxed font-medium text-text-primary/85">{message}</p>
		</div>

		<!-- Dismiss -->
		{#if ondismiss}
			<button
				onclick={handleDismiss}
				class="shrink-0 rounded-full p-1.5 text-text-muted/50 hover:text-danger hover:bg-danger/8 transition-smooth"
				aria-label="Fermer"
			>
				<X size={15} strokeWidth={2} />
			</button>
		{/if}
	</div>
{/if}

<style>
	@keyframes error-slide-in {
		from {
			opacity: 0;
			transform: translateY(-8px) scale(0.98);
			filter: blur(2px);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
			filter: blur(0);
		}
	}

	@keyframes error-slide-out {
		from {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		to {
			opacity: 0;
			transform: translateY(-8px) scale(0.96);
		}
	}

	.error-banner {
		animation: error-slide-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.error-banner-out {
		animation: error-slide-out 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
	}
</style>
