<script lang="ts">
	import { Landmark, Upload, PieChart, Tag, ChevronRight, Sparkles, X } from 'lucide-svelte';
	import { execute, query } from '$lib/stores/db';

	let visible = $state(true);
	let currentStep = $state(0);

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

			<div class="mt-5 flex justify-end">
				<button onclick={dismiss} class="text-[12px] font-medium text-text-muted hover:text-text-primary transition-smooth">
					Ne plus afficher
				</button>
			</div>
		</div>
	</div>
{/if}
