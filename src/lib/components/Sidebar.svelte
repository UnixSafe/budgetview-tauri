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
		RefreshCw
	} from 'lucide-svelte';

	const navItems = [
		{ label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
		{ label: 'Comptes', href: '/accounts', icon: Landmark },
		{ label: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
		{ label: 'Import', href: '/import', icon: Upload },
		{ label: 'Export', href: '/export', icon: Download },
		{ label: 'Budget', href: '/budget', icon: PieChart },
		{ label: 'Récurrences', href: '/recurring', icon: RefreshCw },
		{ label: 'Analyse', href: '/analysis', icon: BarChart3 },
		{ label: 'Projets', href: '/projects', icon: FolderKanban },
		{ label: 'Règles auto', href: '/settings/rules', icon: Settings }
	];
</script>

<aside class="flex h-full w-60 flex-col border-r border-border bg-bg-secondary">
	<div class="flex h-14 items-center gap-2 border-b border-border px-4">
		<div class="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">
			B
		</div>
		<span class="text-lg font-semibold text-text-primary">BudgetView</span>
	</div>

	<nav class="flex-1 space-y-1 p-3">
		{#each navItems as item}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
					{active
					? 'bg-accent/10 text-accent'
					: 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}"
			>
				<item.icon size={18} />
				{item.label}
			</a>
		{/each}
	</nav>

	<div class="border-t border-border p-4 text-xs text-text-muted">
		BudgetView v0.1.0
	</div>
</aside>
