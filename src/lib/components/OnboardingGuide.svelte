<script lang="ts">
	import { Landmark, Upload, PieChart, Tag, ChevronRight, Sparkles, X, Database } from 'lucide-svelte';
	import { execute, query } from '$lib/stores/db';
	import { DEMO_ACCOUNTS, DEMO_SERIES, DEMO_TRANSACTIONS } from '$lib/utils/demo-data';
	import { toastStore } from '$lib/stores/toast.svelte';

	let visible = $state(true);
	let currentStep = $state(0);
	let loadingDemo = $state(false);

	async function loadDemoData() {
		if (!confirm('Charger les données de démonstration ? Cela créera des comptes, catégories et transactions fictives.')) return;
		loadingDemo = true;
		try {
			// Create accounts
			const accountIds: number[] = [];
			for (const acc of DEMO_ACCOUNTS) {
				await execute(
					'INSERT INTO accounts (name, account_type, bank_name, initial_balance) VALUES ($1, $2, $3, $4)',
					[acc.name, acc.account_type, acc.bank_name, acc.initial_balance]
				);
				const rows = await query<{ id: number }>('SELECT id FROM accounts ORDER BY id DESC LIMIT 1');
				accountIds.push(rows[0]?.id ?? 0);
			}

			// Create series
			const seriesIds: number[] = [];
			for (const s of DEMO_SERIES) {
				await execute(
					'INSERT INTO budget_series (name, budget_area, target_amount, is_active) VALUES ($1, $2, $3, 1)',
					[s.name, s.budget_area, s.target_amount]
				);
				const rows = await query<{ id: number }>('SELECT id FROM budget_series ORDER BY id DESC LIMIT 1');
				seriesIds.push(rows[0]?.id ?? 0);
			}

			// Create monthly budgets for current and previous months
			const now = new Date();
			for (let offset = -2; offset <= 1; offset++) {
				const m = new Date(now.getFullYear(), now.getMonth() + offset, 1);
				for (let i = 0; i < DEMO_SERIES.length; i++) {
					await execute(
						'INSERT OR IGNORE INTO monthly_budget (series_id, year, month, planned_amount) VALUES ($1, $2, $3, $4)',
						[seriesIds[i], m.getFullYear(), m.getMonth() + 1, DEMO_SERIES[i].target_amount]
					);
				}
			}

			// Create transactions
			for (const tx of DEMO_TRANSACTIONS) {
				const accountId = accountIds[tx.account_index] ?? accountIds[0];
				const seriesId = tx.series_index !== null ? seriesIds[tx.series_index] : null;
				await execute(
					'INSERT INTO transactions (account_id, date, label, amount, series_id) VALUES ($1, $2, $3, $4, $5)',
					[accountId, tx.date, tx.label, tx.amount, seriesId]
				);
			}

			toastStore.success('Données de démonstration chargées !');
			dismiss();
			// Reload the page to show new data
			window.location.reload();
		} catch (e) {
			toastStore.error('Erreur: ' + String(e));
		} finally {
			loadingDemo = false;
		}
	}

	interface OnboardingStep {
		icon: typeof Landmark;
		title: string;
		description: string;
		href: string;
		color: string;
		bgColor: string;
	}

	const steps: OnboardingStep[] = [
		{
			icon: Landmark,
			title: 'Créez vos comptes',
			description: 'Ajoutez vos comptes bancaires (courant, épargne, carte de crédit)',
			href: '/accounts',
			color: 'text-accent',
			bgColor: 'bg-accent/12'
		},
		{
			icon: Upload,
			title: 'Importez vos transactions',
			description: 'Importez vos relevés bancaires au format OFX, QIF ou CSV',
			href: '/import',
			color: 'text-income',
			bgColor: 'bg-income/12'
		},
		{
			icon: PieChart,
			title: 'Configurez votre budget',
			description: 'Créez des catégories et définissez vos montants mensuels',
			href: '/budget',
			color: 'text-warning',
			bgColor: 'bg-warning/12'
		},
		{
			icon: Tag,
			title: 'Catégorisez vos transactions',
			description: 'Associez chaque transaction à une catégorie. L\'auto-catégorisation apprend de vos choix.',
			href: '/transactions',
			color: 'text-purple',
			bgColor: 'bg-purple/12'
		}
	];

	async function dismiss() {
		visible = false;
		await execute(
			`INSERT INTO app_settings (key, value) VALUES ('onboarding_done', '1')
			 ON CONFLICT(key) DO UPDATE SET value = '1'`
		);
	}

	async function checkOnboarding() {
		const rows = await query<{ value: string }>(
			"SELECT value FROM app_settings WHERE key = 'onboarding_done'"
		);
		if (rows[0]?.value === '1') {
			visible = false;
		}
	}

	// Check on mount
	checkOnboarding();
</script>

{#if visible}
	<div class="glass-card p-7 animate-slide-up relative overflow-hidden">
		<!-- Background decoration -->
		<div class="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/5 blur-2xl"></div>
		<div class="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-purple/5 blur-2xl"></div>

		<div class="relative">
			<div class="flex items-start justify-between mb-6">
				<div class="flex items-center gap-3">
					<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12">
						<Sparkles size={22} class="text-accent" strokeWidth={1.8} />
					</div>
					<div>
						<h2 class="text-lg font-bold tracking-tight text-text-primary">Bienvenue dans BudgetView</h2>
						<p class="text-[13px] text-text-muted">4 étapes pour commencer</p>
					</div>
				</div>
				<button onclick={dismiss} class="rounded-xl p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth" aria-label="Fermer le guide">
					<X size={16} />
				</button>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each steps as step, i}
					<a
						href={step.href}
						class="group flex flex-col rounded-2xl border border-border-light p-5 transition-smooth hover:bg-bg-hover/30 btn-press"
					>
						<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl {step.bgColor}">
							<step.icon size={20} class={step.color} strokeWidth={1.8} />
						</div>
						<div class="flex items-center gap-1 mb-1.5">
							<span class="flex h-5 w-5 items-center justify-center rounded-full bg-bg-elevated text-[11px] font-bold text-text-muted">{i + 1}</span>
							<h3 class="text-[13px] font-semibold text-text-primary">{step.title}</h3>
						</div>
						<p class="text-[12px] text-text-muted leading-relaxed flex-1">{step.description}</p>
						<div class="mt-3 flex items-center gap-1 text-[12px] font-medium {step.color} opacity-0 group-hover:opacity-100 transition-smooth">
							Commencer <ChevronRight size={14} />
						</div>
					</a>
				{/each}
			</div>

			<div class="mt-5 flex items-center justify-between">
				<button
					onclick={loadDemoData}
					disabled={loadingDemo}
					class="flex items-center gap-2 rounded-xl bg-accent/10 px-4 py-2 text-[12px] font-semibold text-accent transition-smooth btn-press hover:bg-accent/20 disabled:opacity-40"
				>
					{#if loadingDemo}
						<div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/20 border-t-accent"></div>
						Chargement...
					{:else}
						<Database size={14} />
						Charger des données de démo
					{/if}
				</button>
				<button onclick={dismiss} class="text-[12px] font-medium text-text-muted hover:text-text-primary transition-smooth">
					Ne plus afficher
				</button>
			</div>
		</div>
	</div>
{/if}
