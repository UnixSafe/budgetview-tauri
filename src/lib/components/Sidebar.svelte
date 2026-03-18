<script lang="ts">
	import { page } from '$app/state';
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
		Database
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
	];

	const settingsNav = [
		{ label: 'Règles auto', href: '/settings/rules', icon: Settings },
		{ label: 'Sécurité', href: '/settings/security', icon: Shield },
		{ label: 'Sauvegarde', href: '/settings/backup', icon: Database },
	];

	const allNav = [...mainNav, ...secondaryNav, ...settingsNav];

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
<aside class="hidden md:flex h-full w-[220px] flex-col glass border-r border-glass-border">
	<!-- Logo -->
	<div class="flex h-16 items-center gap-3 px-5">
		<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 shadow-lg shadow-accent/10">
			<span class="text-base font-bold text-accent">B</span>
		</div>
		<span class="text-[17px] font-semibold tracking-tight text-text-primary">BudgetView</span>
	</div>

	<!-- Main nav -->
	<nav class="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-hide">
		<p class="px-3 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Principal</p>
		{#each mainNav as item}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-smooth btn-press
					{active
					? 'bg-accent/15 text-accent shadow-sm'
					: 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}"
			>
				<item.icon size={18} strokeWidth={active ? 2.2 : 1.8} />
				{item.label}
			</a>
		{/each}

		<p class="px-3 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Outils</p>
		{#each secondaryNav as item}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-smooth btn-press
					{active
					? 'bg-accent/15 text-accent shadow-sm'
					: 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}"
			>
				<item.icon size={18} strokeWidth={active ? 2.2 : 1.8} />
				{item.label}
			</a>
		{/each}

		<p class="px-3 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Réglages</p>
		{#each settingsNav as item}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-smooth btn-press
					{active
					? 'bg-accent/15 text-accent shadow-sm'
					: 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}"
			>
				<item.icon size={18} strokeWidth={active ? 2.2 : 1.8} />
				{item.label}
			</a>
		{/each}
	</nav>

	<!-- Footer -->
	<div class="px-5 py-3 text-[11px] text-text-muted border-t border-border-light">
		BudgetView v0.1.0
	</div>
</aside>

<!-- Mobile bottom navigation -->
<nav class="fixed bottom-0 left-0 right-0 z-50 md:hidden glass border-t border-glass-border safe-area-bottom">
	<div class="flex items-center justify-around px-2 py-1">
		{#each mobileNav as item}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				class="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-[10px] font-medium transition-smooth btn-press
					{active ? 'text-accent' : 'text-text-muted'}"
			>
				<item.icon size={22} strokeWidth={active ? 2.2 : 1.6} />
				{item.label}
			</a>
		{/each}
	</div>
</nav>
