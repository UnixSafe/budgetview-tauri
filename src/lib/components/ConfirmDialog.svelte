<script lang="ts">
	import { AlertTriangle, X } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'danger' | 'warning' | 'info';
		onconfirm: () => void;
		oncancel: () => void;
	}

	let {
		open,
		title,
		message,
		confirmLabel = 'Confirmer',
		cancelLabel = 'Annuler',
		variant = 'danger',
		onconfirm,
		oncancel,
	}: Props = $props();

	const variantStyles = {
		danger: {
			iconBg: 'bg-danger/10',
			iconColor: 'text-danger',
			buttonBg: 'bg-danger hover:bg-danger/90',
		},
		warning: {
			iconBg: 'bg-warning/10',
			iconColor: 'text-warning',
			buttonBg: 'bg-warning hover:bg-warning/90 text-black',
		},
		info: {
			iconBg: 'bg-accent/10',
			iconColor: 'text-accent',
			buttonBg: 'bg-accent hover:bg-accent-hover',
		},
	};

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') oncancel();
		if (e.key === 'Enter') onconfirm();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	{@const style = variantStyles[variant]}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[150] flex items-center justify-center modal-overlay animate-fade-in" onclick={oncancel}>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="relative w-full max-w-sm glass-card p-6 shadow-2xl animate-modal-in mx-4" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-start gap-4">
				<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl {style.iconBg}">
					<AlertTriangle size={20} class={style.iconColor} strokeWidth={1.8} />
				</div>
				<div class="flex-1">
					<h3 class="text-[15px] font-semibold text-text-primary">{title}</h3>
					<p class="mt-1.5 text-[13px] text-text-secondary leading-relaxed">{message}</p>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-2.5">
				<button
					onclick={oncancel}
					class="rounded-xl px-4 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-smooth"
				>
					{cancelLabel}
				</button>
				<button
					onclick={onconfirm}
					class="rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press {style.buttonBg}"
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
