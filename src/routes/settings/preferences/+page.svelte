<script lang="ts">
	import { onMount } from 'svelte';
	import { Settings, Calendar, Globe, Clock } from 'lucide-svelte';
	import { query, execute } from '$lib/stores/db';
	import { toastStore } from '$lib/stores/toast.svelte';

	let dateFormat = $state('dd/MM/yyyy');
	let forecastMonths = $state(12);
	let firstDayOfMonth = $state(1);
	let loading = $state(true);

	const DATE_FORMATS = [
		{ value: 'dd/MM/yyyy', label: '15/03/2026', example: 'JJ/MM/AAAA' },
		{ value: 'dd-MM-yyyy', label: '15-03-2026', example: 'JJ-MM-AAAA' },
		{ value: 'yyyy-MM-dd', label: '2026-03-15', example: 'AAAA-MM-JJ (ISO)' },
		{ value: 'dd MMM yyyy', label: '15 mars 2026', example: 'JJ mois AAAA' },
	];

	const FORECAST_OPTIONS = [
		{ value: 6, label: '6 mois' },
		{ value: 12, label: '12 mois' },
		{ value: 18, label: '18 mois' },
		{ value: 24, label: '24 mois' },
		{ value: 36, label: '36 mois' },
	];

	onMount(async () => {
		try {
			// Ensure app_settings table exists
			await execute(`CREATE TABLE IF NOT EXISTS app_settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			)`);

			const settings = await query<{ key: string; value: string }>(
				"SELECT key, value FROM app_settings WHERE key IN ('date_format', 'forecast_months', 'first_day_of_month')"
			);
			for (const s of settings) {
				if (s.key === 'date_format') dateFormat = s.value;
				if (s.key === 'forecast_months') forecastMonths = parseInt(s.value) || 12;
				if (s.key === 'first_day_of_month') firstDayOfMonth = parseInt(s.value) || 1;
			}
		} catch { /* ignore */ }
		loading = false;
	});

	async function saveSetting(key: string, value: string) {
		await execute(
			"INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
			[key, value]
		);
		toastStore.success('Préférence enregistrée');
	}
</script>

<svelte:head>
	<title>Préférences — BudgetView</title>
</svelte:head>

<div class="space-y-8 animate-fade-in">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary">Préférences</h1>
		<p class="mt-1 text-sm text-text-muted">Personnalisez l'affichage de l'application</p>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-accent/20 border-t-accent"></div>
		</div>
	{:else}
		<!-- Date format -->
		<div class="glass-card p-7">
			<div class="mb-6 flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12">
					<Calendar size={22} class="text-accent" strokeWidth={1.8} />
				</div>
				<div>
					<h2 class="text-lg font-semibold text-text-primary">Format de date</h2>
					<p class="text-[13px] text-text-muted">Choisissez comment les dates sont affichées</p>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#each DATE_FORMATS as fmt}
					<button
						onclick={() => { dateFormat = fmt.value; saveSetting('date_format', fmt.value); }}
						class="rounded-2xl border p-4 text-left transition-smooth btn-press
							{dateFormat === fmt.value ? 'border-accent bg-accent/5' : 'border-border hover:bg-bg-hover'}"
					>
						<p class="text-[15px] font-semibold text-text-primary tabular-nums">{fmt.label}</p>
						<p class="mt-1 text-[11px] text-text-muted">{fmt.example}</p>
					</button>
				{/each}
			</div>
		</div>

		<!-- Forecast horizon -->
		<div class="glass-card p-7">
			<div class="mb-6 flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange/12">
					<Clock size={22} class="text-orange" strokeWidth={1.8} />
				</div>
				<div>
					<h2 class="text-lg font-semibold text-text-primary">Horizon prévisionnel</h2>
					<p class="text-[13px] text-text-muted">Nombre de mois affichés dans les prévisions</p>
				</div>
			</div>

			<div class="flex gap-2 flex-wrap">
				{#each FORECAST_OPTIONS as opt}
					<button
						onclick={() => { forecastMonths = opt.value; saveSetting('forecast_months', String(opt.value)); }}
						class="rounded-xl px-5 py-2.5 text-[13px] font-medium transition-smooth btn-press
							{forecastMonths === opt.value ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-hover'}"
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- First day of budget month -->
		<div class="glass-card p-7">
			<div class="mb-6 flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple/12">
					<Settings size={22} class="text-purple" strokeWidth={1.8} />
				</div>
				<div>
					<h2 class="text-lg font-semibold text-text-primary">Premier jour du mois budgétaire</h2>
					<p class="text-[13px] text-text-muted">Définissez quand commence votre mois de budget</p>
				</div>
			</div>

			<div class="flex items-center gap-4">
				<input
					type="number"
					min="1"
					max="28"
					bind:value={firstDayOfMonth}
					onchange={() => saveSetting('first_day_of_month', String(firstDayOfMonth))}
					class="w-20 rounded-xl border border-border bg-bg-input px-4 py-3 text-center text-[15px] font-semibold text-text-primary outline-none focus-ring"
				/>
				<p class="text-[13px] text-text-secondary">
					{#if firstDayOfMonth === 1}
						Standard — le mois commence le 1er
					{:else}
						Le mois budgétaire commence le {firstDayOfMonth} de chaque mois
					{/if}
				</p>
			</div>
		</div>
	{/if}
</div>
