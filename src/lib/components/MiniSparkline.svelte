<script lang="ts">
	interface Props {
		values: number[];
		color?: string;
		height?: number;
		width?: number;
	}

	let { values, color = '#0a84ff', height = 24, width = 80 }: Props = $props();

	let pathD = $derived.by(() => {
		if (values.length < 2) return '';
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;
		const stepX = width / (values.length - 1);
		const padding = 2;
		const chartH = height - padding * 2;

		return values
			.map((v, i) => {
				const x = i * stepX;
				const y = padding + chartH - ((v - min) / range) * chartH;
				return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(' ');
	});

	let areaPath = $derived.by(() => {
		if (values.length < 2) return '';
		return `${pathD} L ${width} ${height} L 0 ${height} Z`;
	});

	let endDotY = $derived.by(() => {
		if (values.length < 2) return 0;
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;
		return 2 + (height - 4) - ((values[values.length - 1] - min) / range) * (height - 4);
	});
</script>

{#if values.length >= 2}
	<svg {width} {height} viewBox="0 0 {width} {height}" class="overflow-visible">
		<path d={areaPath} fill="{color}" opacity="0.08" />
		<path d={pathD} fill="none" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
		<circle cx={width} cy={endDotY} r="2" fill="{color}" />
	</svg>
{/if}
