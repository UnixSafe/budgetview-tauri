<script lang="ts">
	import { Landmark, Upload, PieChart, TrendingUp, ChevronRight, ChevronLeft, Sparkles } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let { onclose }: { onclose: () => void } = $props();

	let step = $state(0);

	const steps = [
		{
			icon: Sparkles,
			iconColor: 'text-accent',
			iconBg: 'bg-accent/12',
			title: 'Bienvenue dans BudgetView',
			description: 'Votre application de gestion de budget personnel. Prenez le contrôle de vos finances en quelques étapes simples.',
		},
		{
			icon: Landmark,
			iconColor: 'text-income',
			iconBg: 'bg-income/12',
			title: 'Ajoutez vos comptes',
			description: 'Commencez par créer vos comptes bancaires : compte courant, livrets d\'épargne, cartes de crédit...',
			action: '/accounts',
			actionLabel: 'Créer un compte',
		},
		{
			icon: Upload,
			iconColor: 'text-purple',
			iconBg: 'bg-purple/12',
			title: 'Importez vos relevés',
			description: 'Importez vos fichiers bancaires (OFX, QIF, CSV) pour retrouver tout votre historique de transactions.',
			action: '/import',
			actionLabel: 'Importer',
		},
		{
			icon: PieChart,
			iconColor: 'text-warning',
			iconBg: 'bg-warning/12',
			title: 'Catégorisez vos dépenses',
			description: 'Créez des catégories de budget et assignez vos transactions. BudgetView apprend vos habitudes et catégorise automatiquement.',
			action: '/budget',
			actionLabel: 'Gérer le budget',
		},
		{
			icon: TrendingUp,
			iconColor: 'text-cyan',
			iconBg: 'bg-cyan/12',
			title: 'Analysez et planifiez',
			description: 'Visualisez l\'évolution de vos finances, suivez votre budget mensuel et prévoyez les mois à venir.',
			action: '/analysis',
			actionLabel: 'Voir l\'analyse',
		},
	];

	function next() {
		if (step < steps.length - 1) step++;
		else onclose();
	}

	function prev() {
		if (step > 0) step--;
	}

	function goToAction() {
		const action = steps[step].action;
		if (action) {
			onclose();
			goto(action);
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in" role="dialog">
	<div class="absolute inset-0" onclick={onclose}></div>
	<div class="relative w-full max-w-lg glass-card p-10 shadow-2xl animate-modal-in mx-4 text-center">
		{@const s = steps[step]}

		<div class="mb-8 flex justify-center">
			<div class="flex h-20 w-20 items-center justify-center rounded-3xl {s.iconBg}">
				<s.icon size={36} class={s.iconColor} strokeWidth={1.5} />
			</div>
		</div>

		<h2 class="text-2xl font-bold tracking-tight text-text-primary mb-3">{s.title}</h2>
		<p class="text-[14px] text-text-secondary leading-relaxed">{s.description}</p>

		{#if s.action}
			<button onclick={goToAction}
				class="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent/10 px-5 py-2.5 text-[13px] font-semibold text-accent transition-smooth hover:bg-accent/20 btn-press">
				{s.actionLabel}
				<ChevronRight size={14} />
			</button>
		{/if}

		<!-- Progress dots -->
		<div class="mt-8 flex items-center justify-center gap-2">
			{#each steps as _, i}
				<button
					onclick={() => (step = i)}
					class="h-2 rounded-full transition-all duration-300 {i === step ? 'w-8 bg-accent' : 'w-2 bg-bg-elevated hover:bg-text-muted'}"
					aria-label="Étape {i + 1}"
				></button>
			{/each}
		</div>

		<!-- Navigation -->
		<div class="mt-8 flex items-center justify-between">
			<button
				onclick={prev}
				disabled={step === 0}
				class="flex items-center gap-1 rounded-xl px-4 py-2.5 text-[13px] font-medium text-text-muted transition-smooth hover:text-text-primary disabled:opacity-0"
			>
				<ChevronLeft size={14} />
				Précédent
			</button>

			{#if step === steps.length - 1}
				<button onclick={onclose}
					class="rounded-xl bg-accent px-8 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20">
					Commencer
				</button>
			{:else}
				<button onclick={next}
					class="flex items-center gap-1 rounded-xl bg-accent px-6 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20">
					Suivant
					<ChevronRight size={14} />
				</button>
			{/if}
		</div>

		<!-- Skip link -->
		<button onclick={onclose} class="mt-4 text-[12px] text-text-muted hover:text-text-secondary transition-smooth">
			Passer l'introduction
		</button>
	</div>
</div>
