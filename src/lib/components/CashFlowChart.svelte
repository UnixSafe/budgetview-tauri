<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency } from '$lib/utils/format';
	import { confidentialStore } from '$lib/stores/confidential.svelte';

	interface DataPoint {
		label: string;
		income: number;
		expenses: number;
		net: number;
	}

	let { data = [] }: { data: DataPoint[] } = $props();

	let canvas: HTMLCanvasElement;
	let hoveredIndex = $state<number | null>(null);

	const CHART_HEIGHT = 180;
	const BAR_GAP = 8;
	const PADDING = { top: 20, right: 16, bottom: 36, left: 16 };

	function draw() {
		if (!canvas || data.length === 0) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, rect.width, rect.height);

		const chartW = rect.width - PADDING.left - PADDING.right;
		const chartH = rect.height - PADDING.top - PADDING.bottom;
		const maxVal = Math.max(...data.map(d => Math.max(d.income, Math.abs(d.expenses))), 1);
		const groupWidth = chartW / data.length;
		const barWidth = (groupWidth - BAR_GAP * 3) / 2;

		// Draw horizontal grid lines
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
		ctx.lineWidth = 1;
		for (let i = 0; i <= 4; i++) {
			const y = PADDING.top + (chartH / 4) * i;
			ctx.beginPath();
			ctx.moveTo(PADDING.left, y);
			ctx.lineTo(rect.width - PADDING.right, y);
			ctx.stroke();
		}

		// Draw bars
		data.forEach((d, i) => {
			const x = PADDING.left + groupWidth * i;
			const isHovered = hoveredIndex === i;

			// Income bar
			const incomeH = (d.income / maxVal) * chartH;
			const incomeY = PADDING.top + chartH - incomeH;
			const gradient1 = ctx.createLinearGradient(0, incomeY, 0, incomeY + incomeH);
			gradient1.addColorStop(0, isHovered ? 'rgba(48, 209, 88, 0.9)' : 'rgba(48, 209, 88, 0.7)');
			gradient1.addColorStop(1, isHovered ? 'rgba(48, 209, 88, 0.5)' : 'rgba(48, 209, 88, 0.3)');
			ctx.fillStyle = gradient1;
			roundRect(ctx, x + BAR_GAP, incomeY, barWidth, incomeH, 4);

			// Expense bar
			const expenseH = (Math.abs(d.expenses) / maxVal) * chartH;
			const expenseY = PADDING.top + chartH - expenseH;
			const gradient2 = ctx.createLinearGradient(0, expenseY, 0, expenseY + expenseH);
			gradient2.addColorStop(0, isHovered ? 'rgba(255, 69, 58, 0.9)' : 'rgba(255, 69, 58, 0.7)');
			gradient2.addColorStop(1, isHovered ? 'rgba(255, 69, 58, 0.5)' : 'rgba(255, 69, 58, 0.3)');
			ctx.fillStyle = gradient2;
			roundRect(ctx, x + BAR_GAP * 2 + barWidth, expenseY, barWidth, expenseH, 4);

			// Month label
			ctx.fillStyle = isHovered ? 'rgba(245, 245, 247, 0.9)' : 'rgba(161, 161, 166, 0.7)';
			ctx.font = `${isHovered ? '600' : '500'} 11px -apple-system, system-ui, sans-serif`;
			ctx.textAlign = 'center';
			ctx.fillText(d.label, x + groupWidth / 2, rect.height - 8);
		});

		// Draw net balance line overlay
		if (data.length > 1) {
			const maxNet = Math.max(...data.map(d => Math.abs(d.net)), 1);
			const netScale = Math.max(maxVal, maxNet);

			ctx.beginPath();
			ctx.strokeStyle = 'rgba(10, 132, 255, 0.7)';
			ctx.lineWidth = 2;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			ctx.setLineDash([]);

			data.forEach((d, i) => {
				const x = PADDING.left + groupWidth * i + groupWidth / 2;
				const netH = (d.net / netScale) * chartH;
				const y = PADDING.top + chartH - Math.max(netH, 0);
				if (i === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			});
			ctx.stroke();

			// Draw dots on the net line
			data.forEach((d, i) => {
				const x = PADDING.left + groupWidth * i + groupWidth / 2;
				const netH = (d.net / netScale) * chartH;
				const y = PADDING.top + chartH - Math.max(netH, 0);
				const isHov = hoveredIndex === i;
				ctx.beginPath();
				ctx.arc(x, y, isHov ? 4 : 2.5, 0, Math.PI * 2);
				ctx.fillStyle = d.net >= 0 ? '#0a84ff' : '#ff453a';
				ctx.fill();
			});
		}
	}

	function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
		if (h < 1) return;
		r = Math.min(r, h / 2, w / 2);
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
		ctx.fill();
	}

	function handleMouseMove(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left - PADDING.left;
		const chartW = rect.width - PADDING.left - PADDING.right;
		const groupWidth = chartW / data.length;
		const idx = Math.floor(x / groupWidth);
		hoveredIndex = idx >= 0 && idx < data.length ? idx : null;
	}

	function handleMouseLeave() {
		hoveredIndex = null;
	}

	$effect(() => {
		if (data) draw();
	});

	$effect(() => {
		hoveredIndex; // react to hover changes
		draw();
	});

	onMount(() => {
		draw();
		const observer = new ResizeObserver(() => draw());
		observer.observe(canvas);
		return () => observer.disconnect();
	});
</script>

<div class="relative">
	<canvas
		bind:this={canvas}
		style="width: 100%; height: {CHART_HEIGHT}px"
		onmousemove={handleMouseMove}
		onmouseleave={handleMouseLeave}
		role="img"
		aria-label="Graphique des flux de trésorerie"
	></canvas>

	<!-- Tooltip -->
	{#if hoveredIndex !== null && data[hoveredIndex]}
		{@const d = data[hoveredIndex]}
		<div class="absolute top-2 left-1/2 -translate-x-1/2 glass-card-sm px-4 py-2.5 shadow-xl pointer-events-none animate-fade-in z-10">
			<p class="text-[11px] font-semibold text-text-secondary mb-1.5 text-center capitalize">{d.label}</p>
			<div class="flex gap-4 text-[12px] tabular-nums">
				<div class="flex items-center gap-1.5">
					<div class="h-2 w-2 rounded-full bg-income"></div>
					<span class="text-income font-medium">{confidentialStore.format(d.income)}</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="h-2 w-2 rounded-full bg-expense"></div>
					<span class="text-expense font-medium">{confidentialStore.format(d.expenses)}</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="h-2 w-2 rounded-full bg-accent"></div>
					<span class="{d.net >= 0 ? 'text-income' : 'text-expense'} font-medium">{confidentialStore.format(d.net)}</span>
				</div>
			</div>
		</div>
	{/if}

	<!-- Legend -->
	<div class="flex items-center justify-center gap-5 mt-2">
		<div class="flex items-center gap-1.5 text-[11px] text-text-muted">
			<div class="h-2 w-2 rounded-full bg-income/70"></div>
			Revenus
		</div>
		<div class="flex items-center gap-1.5 text-[11px] text-text-muted">
			<div class="h-2 w-2 rounded-full bg-expense/70"></div>
			Dépenses
		</div>
		<div class="flex items-center gap-1.5 text-[11px] text-text-muted">
			<div class="h-2 w-2 rounded-full bg-accent/70"></div>
			Solde net
		</div>
	</div>
</div>
