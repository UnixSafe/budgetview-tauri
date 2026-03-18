<script lang="ts">
	import { formatCurrency } from '$lib/utils/format';

	interface Props {
		planned: number;
		actual: number;
		label: string;
	}

	let { planned, actual, label }: Props = $props();

	let percentage = $derived(planned === 0 ? 0 : Math.min((Math.abs(actual) / Math.abs(planned)) * 100, 150));
	let status = $derived.by(() => {
		if (percentage > 100) return 'over';
		if (percentage > 80) return 'warning';
		return 'ok';
	});

	let statusColor = $derived(
		status === 'over' ? 'text-expense' :
		status === 'warning' ? 'text-warning' :
		'text-income'
	);

	let barColor = $derived(
		status === 'over' ? 'bg-expense' :
		status === 'warning' ? 'bg-warning' :
		'bg-income'
	);

	let statusLabel = $derived(
		status === 'over' ? 'Dépassé' :
		status === 'warning' ? 'Attention' :
		'En bonne voie'
	);
</script>

<div class="flex items-center gap-4">
	<!-- Circular progress -->
	<div class="relative flex h-14 w-14 shrink-0 items-center justify-center">
		<svg viewBox="0 0 40 40" class="h-14 w-14 -rotate-90">
			<!-- Background circle -->
			<circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3" />
			<!-- Progress circle -->
			<circle
				cx="20" cy="20" r="16" fill="none"
				stroke={status === 'over' ? '#ff453a' : status === 'warning' ? '#ffd60a' : '#30d158'}
				stroke-width="3"
				stroke-linecap="round"
				stroke-dasharray={`${Math.min(percentage, 100)} ${100 - Math.min(percentage, 100)}`}
				class="transition-all duration-700 ease-out"
				style="filter: drop-shadow(0 0 4px {status === 'over' ? 'rgba(255,69,58,0.4)' : status === 'warning' ? 'rgba(255,214,10,0.3)' : 'rgba(48,209,88,0.3)'})"
			/>
		</svg>
		<span class="absolute text-[11px] font-bold {statusColor} tabular-nums">
			{Math.round(percentage)}%
		</span>
	</div>

	<!-- Info -->
	<div class="min-w-0 flex-1">
		<p class="text-[13px] font-medium text-text-primary truncate">{label}</p>
		<div class="mt-1 flex items-center gap-2 text-[11px]">
			<span class="font-medium {statusColor}">{statusLabel}</span>
			<span class="text-text-muted">·</span>
			<span class="text-text-muted tabular-nums">{formatCurrency(actual)} / {formatCurrency(planned)}</span>
		</div>
	</div>
</div>
