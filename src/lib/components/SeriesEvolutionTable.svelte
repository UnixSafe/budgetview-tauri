<script lang="ts">
	import { query } from '$lib/stores/db';
	import { formatCurrency, BUDGET_AREA_LABELS } from '$lib/utils/format';
	import { confidentialStore } from '$lib/stores/confidential.svelte';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import type { BudgetArea } from '$lib/types';

	interface Props {
		year: number;
	}

	let { year }: Props = $props();

	interface SeriesRow {
		series_id: number;
		series_name: string;
		budget_area: BudgetArea;
		months: number[]; // 12 values, one per month
	}

	let rows = $state<SeriesRow[]>([]);
	let loading = $state(true);
	let collapsedAreas = $state<Set<string>>(new Set());

	const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

	const AREA_ORDER: BudgetArea[] = ['income', 'recurring', 'variable', 'extras', 'savings', 'transfers'];

	const AREA_COLORS: Record<string, string> = {
		income: 'text-income', recurring: 'text-accent', variable: 'text-warning',
		extras: 'text-purple', savings: 'text-cyan', transfers: 'text-text-muted'
	};

	$effect(() => {
		loadData(year);
	});

	async function loadData(y: number) {
		loading = true;
		try {
			const data = await query<{
				series_id: number;
				series_name: string;
				budget_area: string;
				month: number;
				total: number;
			}>(
				`SELECT bs.id as series_id, bs.name as series_name, bs.budget_area,
					CAST(strftime('%m', COALESCE(t.budget_date, t.date)) AS INTEGER) as month,
					SUM(t.amount) as total
				 FROM transactions t
				 JOIN budget_series bs ON t.series_id = bs.id
				 WHERE strftime('%Y', COALESCE(t.budget_date, t.date)) = $1
				 GROUP BY bs.id, strftime('%m', COALESCE(t.budget_date, t.date))
				 ORDER BY bs.budget_area, bs.name, month`,
				[String(y)]
			);

			// Group by series
			const seriesMap = new Map<number, SeriesRow>();
			for (const row of data) {
				if (!seriesMap.has(row.series_id)) {
					seriesMap.set(row.series_id, {
						series_id: row.series_id,
						series_name: row.series_name,
						budget_area: row.budget_area as BudgetArea,
						months: new Array(12).fill(0),
					});
				}
				const sr = seriesMap.get(row.series_id)!;
				sr.months[row.month - 1] = row.total;
			}

			rows = Array.from(seriesMap.values());
		} catch {
			rows = [];
		} finally {
			loading = false;
		}
	}

	function toggleArea(area: string) {
		const next = new Set(collapsedAreas);
		if (next.has(area)) next.delete(area);
		else next.add(area);
		collapsedAreas = next;
	}

	let groupedByArea = $derived.by(() => {
		const groups: Record<string, SeriesRow[]> = {};
		for (const area of AREA_ORDER) {
			const areaRows = rows.filter(r => r.budget_area === area);
			if (areaRows.length > 0) groups[area] = areaRows;
		}
		return groups;
	});
</script>

{#if loading}
	<div class="flex items-center justify-center py-12">
		<div class="h-6 w-6 animate-spin rounded-full border-2 border-accent/20 border-t-accent"></div>
	</div>
{:else if rows.length === 0}
	<p class="text-center text-[13px] text-text-muted py-8">Aucune donnée catégorisée pour {year}</p>
{:else}
	<div class="overflow-x-auto">
		<table class="w-full text-[12px]">
			<thead>
				<tr class="border-b border-border-light">
					<th class="sticky left-0 bg-bg-card/90 backdrop-blur-sm px-3 py-3 text-left font-semibold text-text-muted min-w-[160px]">Catégorie</th>
					{#each MONTH_LABELS as m}
						<th class="px-2 py-3 text-right font-medium text-text-muted min-w-[70px]">{m}</th>
					{/each}
					<th class="px-3 py-3 text-right font-bold text-text-secondary min-w-[80px]">Total</th>
				</tr>
			</thead>
			<tbody>
				{#each Object.entries(groupedByArea) as [area, areaRows]}
					{@const areaTotal = areaRows.reduce((s, r) => s + r.months.reduce((a, b) => a + b, 0), 0)}
					{@const areaMonthTotals = Array.from({ length: 12 }, (_, m) => areaRows.reduce((s, r) => s + r.months[m], 0))}
					<!-- Area header row -->
					<tr class="border-b border-border-light/50 cursor-pointer hover-row" onclick={() => toggleArea(area)}>
						<td class="sticky left-0 bg-bg-card/90 backdrop-blur-sm px-3 py-2.5 font-bold {AREA_COLORS[area] ?? 'text-text-secondary'}">
							<div class="flex items-center gap-1.5">
								{#if collapsedAreas.has(area)}
									<ChevronRight size={13} />
								{:else}
									<ChevronDown size={13} />
								{/if}
								{BUDGET_AREA_LABELS[area] ?? area}
							</div>
						</td>
						{#each areaMonthTotals as total}
							<td class="px-2 py-2.5 text-right font-semibold tabular-nums {AREA_COLORS[area] ?? 'text-text-secondary'}">{confidentialStore.format(total)}</td>
						{/each}
						<td class="px-3 py-2.5 text-right font-bold tabular-nums {AREA_COLORS[area] ?? 'text-text-secondary'}">{confidentialStore.format(areaTotal)}</td>
					</tr>
					<!-- Series rows -->
					{#if !collapsedAreas.has(area)}
						{#each areaRows as row}
							{@const rowTotal = row.months.reduce((a, b) => a + b, 0)}
							<tr class="border-b border-border-light/30 hover-row">
								<td class="sticky left-0 bg-bg-card/90 backdrop-blur-sm px-3 py-2 pl-7 text-text-secondary font-medium">{row.series_name}</td>
								{#each row.months as val}
									<td class="px-2 py-2 text-right tabular-nums {val === 0 ? 'text-text-muted/30' : val > 0 ? 'text-income' : 'text-expense'}">
										{val === 0 ? '—' : confidentialStore.format(val)}
									</td>
								{/each}
								<td class="px-3 py-2 text-right font-semibold tabular-nums {rowTotal >= 0 ? 'text-income' : 'text-expense'}">{confidentialStore.format(rowTotal)}</td>
							</tr>
						{/each}
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{/if}
