<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Landmark, Pencil, Trash2, X, ArrowLeftRight } from 'lucide-svelte';
	import MiniSparkline from '$lib/components/MiniSparkline.svelte';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { formatCurrency, toEuros, toCents, ACCOUNT_TYPE_LABELS } from '$lib/utils/format';
	import { query } from '$lib/stores/db';
	import type { Account, AccountType } from '$lib/types';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';

	let showForm = $state(false);
	let editingId = $state<number | null>(null);
	let formName = $state('');
	let formNumber = $state('');
	let formBank = $state('');
	let formType = $state<string>('checking');
	let formBalance = $state(0);
	let formThresholdEnabled = $state(false);
	let formThreshold = $state(0);

	let byType = $derived.by(() => {
		const groups: Record<string, { count: number; total: number }> = {};
		for (const a of accountStore.accounts) {
			if (!groups[a.account_type]) groups[a.account_type] = { count: 0, total: 0 };
			groups[a.account_type].count++;
			groups[a.account_type].total += a.computed_balance;
		}
		return groups;
	});

	let monthlyFlows = $state<{ account_id: number; account_name: string; months: { label: string; net: number }[] }[]>([]);
	let sparklineData = $state<Map<number, number[]>>(new Map());

	onMount(async () => {
		await accountStore.load();
		await loadMonthlyFlows();
		await loadSparklines();
	});

	async function loadSparklines() {
		const now = new Date();
		const data = new Map<number, number[]>();

		for (const acc of accountStore.accounts) {
			const values: number[] = [];
			let running = acc.initial_balance;

			for (let offset = -5; offset <= 0; offset++) {
				let m = now.getMonth() + 1 + offset;
				let y = now.getFullYear();
				while (m <= 0) { m += 12; y--; }
				const start = `${y}-${String(m).padStart(2, '0')}-01`;
				const endM = m === 12 ? 1 : m + 1;
				const endY = m === 12 ? y + 1 : y;
				const end = `${endY}-${String(endM).padStart(2, '0')}-01`;

				const result = await query<{ net: number }>(
					'SELECT COALESCE(SUM(amount), 0) as net FROM transactions WHERE account_id = $1 AND date < $2',
					[acc.id, end]
				);
				values.push(acc.initial_balance + (result[0]?.net ?? 0));
			}

			data.set(acc.id, values);
		}

		sparklineData = data;
	}

	async function loadMonthlyFlows() {
		const now = new Date();
		const months: { y: number; m: number; label: string }[] = [];
		for (let offset = -2; offset <= 0; offset++) {
			let m = now.getMonth() + 1 + offset;
			let y = now.getFullYear();
			while (m <= 0) { m += 12; y--; }
			const label = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(y, m - 1));
			months.push({ y, m, label });
		}

		const flows: typeof monthlyFlows = [];
		for (const acc of accountStore.accounts) {
			const accMonths: { label: string; net: number }[] = [];
			for (const { y, m, label } of months) {
				const start = `${y}-${String(m).padStart(2, '0')}-01`;
				const endM = m === 12 ? 1 : m + 1;
				const endY = m === 12 ? y + 1 : y;
				const end = `${endY}-${String(endM).padStart(2, '0')}-01`;
				const result = await query<{ net: number }>(
					'SELECT COALESCE(SUM(amount), 0) as net FROM transactions WHERE account_id = $1 AND date >= $2 AND date < $3',
					[acc.id, start, end]
				);
				accMonths.push({ label, net: result[0]?.net ?? 0 });
			}
			flows.push({ account_id: acc.id, account_name: acc.name, months: accMonths });
		}
		monthlyFlows = flows;
	}

	function openCreate() {
		editingId = null;
		formName = '';
		formNumber = '';
		formBank = '';
		formType = 'checking';
		formBalance = 0;
		formThresholdEnabled = false;
		formThreshold = 0;
		showForm = true;
	}

	function openEdit(account: Account) {
		editingId = account.id;
		formName = account.name;
		formNumber = account.account_number ?? '';
		formBank = account.bank_name ?? '';
		formType = account.account_type;
		formBalance = toEuros(account.initial_balance);
		formThresholdEnabled = !!account.low_balance_enabled;
		formThreshold = account.low_balance_threshold ? toEuros(account.low_balance_threshold) : 0;
		showForm = true;
	}

	async function handleSubmit() {
		if (!formName.trim()) return;
		if (editingId) {
			await accountStore.update(editingId, {
				name: formName,
				account_number: formNumber || null,
				bank_name: formBank || null,
				account_type: formType,
				initial_balance: formBalance
			});
			await accountStore.setThreshold(
				editingId,
				formThresholdEnabled ? toCents(formThreshold) : null,
				formThresholdEnabled
			);
			toastStore.success('Compte modifié');
		} else {
			await accountStore.create({
				name: formName,
				account_number: formNumber || undefined,
				bank_name: formBank || undefined,
				account_type: formType,
				initial_balance: formBalance
			});
			toastStore.success('Compte créé');
		}
		showForm = false;
	}

	async function handleDelete(id: number) {
		if (!confirm('Supprimer ce compte ?')) return;
		await accountStore.remove(id);
		toastStore.success('Compte supprimé');
	}

	const ACCOUNT_ICONS: Record<string, string> = {
		checking: '🏦',
		savings: '💰',
		credit_card: '💳',
		cash: '💵'
	};
</script>

<svelte:head>
	<title>Comptes — BudgetView</title>
</svelte:head>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Comptes</h1>
			<p class="mt-1 text-sm text-text-muted">Gérez vos comptes bancaires</p>
		</div>
		<button
			onclick={openCreate}
			class="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20"
		>
			<Plus size={16} strokeWidth={2.5} />
			Nouveau compte
		</button>
	</div>

	{#if accountStore.error}
		<ErrorBanner message={accountStore.error} ondismiss={() => (accountStore.error = null)} />
	{/if}

	{#if accountStore.loading}
		<LoadingSpinner message="Chargement des comptes..." />
	{:else if accountStore.accounts.length === 0}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center rounded-3xl glass-card p-16">
			<div class="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10">
				<Landmark size={36} class="text-accent" strokeWidth={1.5} />
			</div>
			<p class="text-xl font-semibold text-text-primary">Aucun compte</p>
			<p class="mt-1 text-sm text-text-muted">Ajoutez votre premier compte bancaire pour commencer</p>
			<button
				onclick={openCreate}
				class="mt-6 flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-smooth btn-press hover:bg-accent-hover"
			>
				<Plus size={16} />
				Ajouter un compte
			</button>
		</div>
	{:else}
		<!-- Summary cards -->
		<div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4 stagger-children">
			<div class="glass-card p-5">
				<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Solde total</p>
				<p class="mt-2 text-2xl font-bold tracking-tight text-text-primary">{formatCurrency(accountStore.totalBalance)}</p>
			</div>
			{#each Object.entries(byType) as [type, data]}
				<div class="glass-card p-5">
					<p class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{ACCOUNT_TYPE_LABELS[type]} ({data.count})</p>
					<p class="mt-2 text-xl font-bold tracking-tight {data.total >= 0 ? 'text-income' : 'text-expense'}">{formatCurrency(data.total)}</p>
				</div>
			{/each}
		</div>

		<!-- Monthly flows -->
		{#if monthlyFlows.length > 0}
			<div class="glass-card p-6">
				<h2 class="mb-4 text-[13px] font-semibold text-text-secondary uppercase tracking-wide">Flux mensuels (3 derniers mois)</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-[13px]">
						<thead>
							<tr class="border-b border-border-light text-text-muted">
								<th class="pb-3 text-left font-medium">Compte</th>
								{#each monthlyFlows[0]?.months ?? [] as m}
									<th class="pb-3 text-right font-medium capitalize">{m.label}</th>
								{/each}
								<th class="pb-3 text-right font-medium">Solde</th>
							</tr>
						</thead>
						<tbody>
							{#each monthlyFlows as flow}
								{@const acc = accountStore.accounts.find(a => a.id === flow.account_id)}
								<tr class="border-b border-border-light/50 hover-row">
									<td class="py-3 font-medium text-text-primary">{flow.account_name}</td>
									{#each flow.months as m}
										<td class="py-3 text-right font-medium tabular-nums {m.net >= 0 ? 'text-income' : 'text-expense'}">{formatCurrency(m.net)}</td>
									{/each}
									<td class="py-3 text-right font-semibold tabular-nums {(acc?.computed_balance ?? 0) >= 0 ? 'text-income' : 'text-expense'}">
										{formatCurrency(acc?.computed_balance ?? 0)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Account list -->
		<div class="space-y-3 stagger-children">
			{#each accountStore.accounts as account (account.id)}
				<div class="group glass-card p-5 transition-smooth hover:bg-bg-hover/30 card-hover">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-4">
							<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-xl">
								{ACCOUNT_ICONS[account.account_type] ?? '🏦'}
							</div>
							<div>
								<p class="text-[15px] font-semibold text-text-primary">{account.name}</p>
								<p class="text-[12px] text-text-muted">
									{ACCOUNT_TYPE_LABELS[account.account_type]}
									{#if account.bank_name}
										· {account.bank_name}
									{/if}
									{#if account.account_number}
										· {account.account_number}
									{/if}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-4">
							{#if sparklineData.has(account.id)}
								<MiniSparkline
									values={sparklineData.get(account.id) ?? []}
									color={account.computed_balance >= 0 ? '#30d158' : '#ff453a'}
								/>
							{/if}
							<div class="text-right">
								<span class="text-lg font-bold tabular-nums {account.computed_balance >= 0 ? 'text-income' : 'text-expense'}">
									{formatCurrency(account.computed_balance)}
								</span>
								{#if account.low_balance_enabled && account.low_balance_threshold !== null && account.computed_balance < account.low_balance_threshold}
									<p class="text-[10px] font-medium text-expense mt-0.5">Sous le seuil de {formatCurrency(account.low_balance_threshold)}</p>
								{/if}
							</div>
							<div class="flex gap-1 opacity-0 transition-smooth group-hover:opacity-100">
								<a href="/transactions" class="rounded-xl p-2 text-text-muted transition-smooth hover:bg-bg-hover hover:text-text-primary" aria-label="Transactions" title="Voir les transactions">
									<ArrowLeftRight size={15} />
								</a>
								<button onclick={() => openEdit(account)} class="rounded-xl p-2 text-text-muted transition-smooth hover:bg-bg-hover hover:text-text-primary" aria-label="Modifier">
									<Pencil size={15} />
								</button>
								<button onclick={() => handleDelete(account.id)} class="rounded-xl p-2 text-text-muted transition-smooth hover:bg-danger/10 hover:text-danger" aria-label="Supprimer">
									<Trash2 size={15} />
								</button>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal -->
{#if showForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={() => (showForm = false)}></div>
		<div class="relative w-full max-w-md glass-card p-7 shadow-2xl animate-modal-in mx-4">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-bold tracking-tight text-text-primary">
					{editingId ? 'Modifier le compte' : 'Nouveau compte'}
				</h2>
				<button onclick={() => (showForm = false)} class="rounded-xl p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-smooth">
					<X size={18} />
				</button>
			</div>

			<form onsubmit={handleSubmit} class="space-y-5">
				<div>
					<label for="name" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Nom *</label>
					<input
						id="name"
						bind:value={formName}
						required
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none placeholder:text-text-muted focus-ring"
						placeholder="Compte courant principal"
					/>
				</div>

				<div>
					<label for="type" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Type</label>
					<select
						id="type"
						bind:value={formType}
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring"
					>
						{#each Object.entries(ACCOUNT_TYPE_LABELS) as [value, label]}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="bank" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Banque</label>
						<input
							id="bank"
							bind:value={formBank}
							class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none placeholder:text-text-muted focus-ring"
							placeholder="Crédit Agricole"
						/>
					</div>
					<div>
						<label for="number" class="mb-1.5 block text-[13px] font-medium text-text-secondary">N° compte</label>
						<input
							id="number"
							bind:value={formNumber}
							class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none placeholder:text-text-muted focus-ring"
							placeholder="XXXX1234"
						/>
					</div>
				</div>

				<div>
					<label for="balance" class="mb-1.5 block text-[13px] font-medium text-text-secondary">Solde initial</label>
					<input
						id="balance"
						type="number"
						step="0.01"
						bind:value={formBalance}
						class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-3 text-[14px] text-text-primary outline-none focus-ring"
					/>
				</div>

				<!-- Balance threshold alert -->
				{#if editingId}
					<div class="border-t border-border-light pt-4">
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={formThresholdEnabled}
								class="accent-accent rounded"
							/>
							<span class="text-[13px] font-medium text-text-secondary">Alerte solde bas</span>
						</label>
						{#if formThresholdEnabled}
							<div class="mt-3">
								<label for="threshold" class="mb-1.5 block text-[12px] font-medium text-text-muted">Seuil d'alerte (€)</label>
								<input
									id="threshold"
									type="number"
									step="0.01"
									bind:value={formThreshold}
									class="w-full rounded-xl border border-border bg-bg-primary/60 px-4 py-2.5 text-[13px] text-text-primary outline-none focus-ring"
									placeholder="500"
								/>
								<p class="mt-1 text-[11px] text-text-muted">Alerte sur le tableau de bord si le solde passe sous ce montant</p>
							</div>
						{/if}
					</div>
				{/if}

				<div class="flex justify-end gap-3 pt-3">
					<button type="button" onclick={() => (showForm = false)} class="rounded-xl px-5 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-smooth">
						Annuler
					</button>
					<button type="submit" class="rounded-xl bg-accent px-6 py-2.5 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20">
						{editingId ? 'Enregistrer' : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
