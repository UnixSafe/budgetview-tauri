<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { query } from '$lib/stores/db';
	import { formatCurrency } from '$lib/utils/format';
	import {
		LayoutDashboard,
		Landmark,
		ArrowLeftRight,
		PieChart,
		BarChart3,
		FolderKanban,
		Upload,
		Download,
		Settings,
		RefreshCw,
		Shield,
		Database,
		StickyNote
	} from 'lucide-svelte';

	const mainNav = [
		{ label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
		{ label: 'Comptes', href: '/accounts', icon: Landmark },
		{ label: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
		{ label: 'Budget', href: '/budget', icon: PieChart },
		{ label: 'Analyse', href: '/analysis', icon: BarChart3 },
	];

	const secondaryNav = [
		{ label: 'Import', href: '/import', icon: Upload },
		{ label: 'Export', href: '/export', icon: Download },
		{ label: 'Récurrences', href: '/recurring', icon: RefreshCw },
		{ label: 'Projets', href: '/projects', icon: FolderKanban },
		{ label: 'Notes', href: '/notes', icon: StickyNote },
	];

	const settingsNav = [
		{ label: 'Réglages', href: '/settings', icon: Settings },
	];

	const allNav = [...mainNav, ...secondaryNav, ...settingsNav];

	let totalBalance = $state<number | null>(null);

	onMount(async () => {
		try {
			const result = await query<{ total: number }>(
				`SELECT COALESCE(SUM(a.initial_balance), 0) + COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.account_id IN (SELECT id FROM accounts WHERE is_active = 1)), 0) as total FROM accounts a WHERE a.is_active = 1`
			);
			totalBalance = result[0]?.total ?? 0;
		} catch { /* ignore */ }
	});

	// Mobile bottom nav: show only main items
	const mobileNav = [
		{ label: 'Accueil', href: '/dashboard', icon: LayoutDashboard },
		{ label: 'Comptes', href: '/accounts', icon: Landmark },
		{ label: 'Opérations', href: '/transactions', icon: ArrowLeftRight },
		{ label: 'Budget', href: '/budget', icon: PieChart },
		{ label: 'Plus', href: '/analysis', icon: BarChart3 },
	];
</script>

<!-- Desktop sidebar -->
<aside class="hidden md:flex h-full w-[232px] flex-col glass border-r border-glass-border relative overflow-hidden">
	<!-- Subtle ambient glow at the top -->
	<div class="pointer-events-none absolute -top-24 -left-12 h-48 w-48 rounded-full bg-accent/[0.04] blur-3xl"></div>

	<!-- Logo area with gradient accent background -->
	<div class="relative px-5 pt-5 pb-4">
		<div class="flex items-center gap-3.5">
			<div class="sidebar-logo-icon relative flex h-10 w-10 items-center justify-center rounded-[13px] shadow-lg">
				<span class="relative z-10 text-[15px] font-bold text-white tracking-tight">B</span>
			</div>
			<div class="flex flex-col">
				<span class="text-[16px] font-semibold tracking-tight text-text-primary leading-tight">BudgetView</span>
				<span class="text-[10.5px] font-medium text-text-muted leading-tight mt-0.5">Gestion de budget</span>
			</div>
		</div>
		<!-- Separator -->
		<div class="divider mt-4"></div>
	</div>

	<!-- Quick search hint -->
	<div class="px-3 mb-2">
		<button
			onclick={() => {
				const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
				window.dispatchEvent(event);
			}}
			class="flex w-full items-center gap-2.5 rounded-xl bg-bg-hover/50 px-3 py-2 text-[12px] text-text-muted/60 transition-smooth hover:bg-bg-hover hover:text-text-muted"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
			<span class="flex-1 text-left">Rechercher...</span>
			<kbd class="rounded bg-bg-elevated/80 px-1.5 py-0.5 text-[9px] font-semibold text-text-muted/50">⌘K</kbd>
		</button>
	</div>

	<!-- Main nav -->
	<nav class="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5 scrollbar-hide">
		<p class="sidebar-section-label px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted/70">
			Principal
		</p>
		{#each mainNav as item}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				class="sidebar-nav-item group relative flex items-center gap-3 rounded-xl px-3 py-[9px] text-[13px] font-medium transition-smooth btn-press
					{active
					? 'sidebar-nav-active text-accent'
					: 'text-text-secondary hover:text-text-primary'}"
			>
				<!-- Active left border indicator -->
				{#if active}
					<div class="absolute left-0 top-1/2 -translate-y-1/2 h-[18px] w-[3px] rounded-r-full bg-accent shadow-[0_0_8px_rgba(10,132,255,0.4)] transition-smooth"></div>
				{/if}
				<!-- Hover background that slides in -->
				<div class="absolute inset-0 rounded-xl bg-bg-hover opacity-0 group-hover:opacity-100 transition-smooth {active ? '!opacity-0' : ''}"></div>
				<div class="relative z-10 flex items-center gap-3">
					<item.icon size={18} strokeWidth={active ? 2.2 : 1.7} class={active ? 'drop-shadow-[0_0_6px_rgba(10,132,255,0.3)]' : ''} />
					<span>{item.label}</span>
				</div>
			</a>
		{/each}

		<p class="sidebar-section-label px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted/70">
			Outils
		</p>
		{#each secondaryNav as item}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				class="sidebar-nav-item group relative flex items-center gap-3 rounded-xl px-3 py-[9px] text-[13px] font-medium transition-smooth btn-press
					{active
					? 'sidebar-nav-active text-accent'
					: 'text-text-secondary hover:text-text-primary'}"
			>
				{#if active}
					<div class="absolute left-0 top-1/2 -translate-y-1/2 h-[18px] w-[3px] rounded-r-full bg-accent shadow-[0_0_8px_rgba(10,132,255,0.4)] transition-smooth"></div>
				{/if}
				<div class="absolute inset-0 rounded-xl bg-bg-hover opacity-0 group-hover:opacity-100 transition-smooth {active ? '!opacity-0' : ''}"></div>
				<div class="relative z-10 flex items-center gap-3">
					<item.icon size={18} strokeWidth={active ? 2.2 : 1.7} class={active ? 'drop-shadow-[0_0_6px_rgba(10,132,255,0.3)]' : ''} />
					<span>{item.label}</span>
				</div>
			</a>
		{/each}

		<p class="sidebar-section-label px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted/70">
			Réglages
		</p>
		{#each settingsNav as item}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				class="sidebar-nav-item group relative flex items-center gap-3 rounded-xl px-3 py-[9px] text-[13px] font-medium transition-smooth btn-press
					{active
					? 'sidebar-nav-active text-accent'
					: 'text-text-secondary hover:text-text-primary'}"
			>
				{#if active}
					<div class="absolute left-0 top-1/2 -translate-y-1/2 h-[18px] w-[3px] rounded-r-full bg-accent shadow-[0_0_8px_rgba(10,132,255,0.4)] transition-smooth"></div>
				{/if}
				<div class="absolute inset-0 rounded-xl bg-bg-hover opacity-0 group-hover:opacity-100 transition-smooth {active ? '!opacity-0' : ''}"></div>
				<div class="relative z-10 flex items-center gap-3">
					<item.icon size={18} strokeWidth={active ? 2.2 : 1.7} class={active ? 'drop-shadow-[0_0_6px_rgba(10,132,255,0.3)]' : ''} />
					<span>{item.label}</span>
				</div>
			</a>
		{/each}
	</nav>

	<!-- Footer with balance and version -->
	<div class="px-4 py-3 border-t border-glass-border space-y-2">
		{#if totalBalance !== null}
			<div class="rounded-xl bg-bg-hover/30 px-3 py-2">
				<p class="text-[9px] font-semibold text-text-muted/60 uppercase tracking-wider">Solde total</p>
				<p class="text-[14px] font-bold tabular-nums tracking-tight {totalBalance >= 0 ? 'text-income' : 'text-expense'}">
					{formatCurrency(totalBalance)}
				</p>
			</div>
		{/if}
		<div class="flex items-center gap-2 px-1">
			<span class="inline-flex items-center rounded-md bg-accent/[0.08] px-2 py-0.5 text-[10px] font-semibold text-accent/80 tracking-wide ring-1 ring-inset ring-accent/[0.12]">
				v0.1.0
			</span>
			<span class="text-[10.5px] text-text-muted/50 font-medium">beta</span>
		</div>
	</div>
</aside>

<!-- Mobile bottom navigation -->
<nav class="fixed bottom-0 left-0 right-0 z-50 md:hidden glass border-t border-glass-border safe-area-bottom">
	<div class="flex items-center justify-around px-1 pt-1.5 pb-1">
		{#each mobileNav as item}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				class="group relative flex flex-col items-center gap-0.5 rounded-xl px-3.5 py-1.5 text-[10px] font-medium transition-smooth btn-press
					{active ? 'text-accent' : 'text-text-muted'}"
			>
				<item.icon size={22} strokeWidth={active ? 2.2 : 1.6} class={active ? 'drop-shadow-[0_0_6px_rgba(10,132,255,0.3)]' : ''} />
				<span class="mt-0.5">{item.label}</span>
				<!-- Active indicator dot -->
				{#if active}
					<div class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[4px] w-[4px] rounded-full bg-accent shadow-[0_0_6px_rgba(10,132,255,0.5)]"></div>
				{/if}
			</a>
		{/each}
	</div>
</nav>

<style>
	/* Logo icon gradient */
	.sidebar-logo-icon {
		background: linear-gradient(145deg, #0a84ff 0%, #0070e0 50%, #005bb5 100%);
		box-shadow:
			0 4px 12px rgba(10, 132, 255, 0.3),
			0 1px 3px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.15);
	}

	/* Active nav item background */
	.sidebar-nav-active {
		background: rgba(10, 132, 255, 0.08);
	}
</style>
