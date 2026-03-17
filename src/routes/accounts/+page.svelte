<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Landmark, Pencil, Trash2, X } from 'lucide-svelte';
	import { accountStore } from '$lib/stores/accounts.svelte';
	import { formatCurrency, toEuros, ACCOUNT_TYPE_LABELS } from '$lib/utils/format';
	import type { Account } from '$lib/types';
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

	onMount(() => {
		accountStore.load();
	});

	function openCreate() {
		editingId = null;
		formName = '';
		formNumber = '';
		formBank = '';
		formType = 'checking';
		formBalance = 0;
		showForm = true;
	}

	function openEdit(account: Account) {
		editingId = account.id;
		formName = account.name;
		formNumber = account.account_number ?? '';
		formBank = account.bank_name ?? '';
		formType = account.account_type;
		formBalance = toEuros(account.initial_balance);
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
</script>

<svelte:head>
	<title>Comptes — BudgetView</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-text-primary">Comptes</h1>
		<button
			onclick={openCreate}
			class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
		>
			<Plus size={16} />
			Nouveau compte
		</button>
	</div>

	{#if accountStore.error}
		<ErrorBanner message={accountStore.error} ondismiss={() => (accountStore.error = null)} />
	{/if}

	{#if accountStore.loading}
		<LoadingSpinner message="Chargement des comptes..." />
	{:else if accountStore.accounts.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card p-12">
			<Landmark size={48} class="mb-4 text-text-muted" />
			<p class="text-lg font-medium text-text-secondary">Aucun compte</p>
			<p class="text-sm text-text-muted">Ajoutez votre premier compte bancaire pour commencer</p>
		</div>
	{:else}
		<!-- Solde total -->
		<div class="rounded-xl border border-border bg-bg-card p-4">
			<span class="text-sm text-text-secondary">Solde total</span>
			<span class="ml-2 text-xl font-bold text-text-primary">{formatCurrency(accountStore.totalBalance)}</span>
		</div>

		<!-- Liste des comptes -->
		<div class="space-y-3">
			{#each accountStore.accounts as account (account.id)}
				<div class="flex items-center justify-between rounded-xl border border-border bg-bg-card p-4 transition-colors hover:bg-bg-hover">
					<div class="flex items-center gap-4">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
							<Landmark size={20} class="text-accent" />
						</div>
						<div>
							<p class="font-medium text-text-primary">{account.name}</p>
							<p class="text-sm text-text-secondary">
								{ACCOUNT_TYPE_LABELS[account.account_type]}
								{#if account.bank_name}
									&middot; {account.bank_name}
								{/if}
								{#if account.account_number}
									&middot; {account.account_number}
								{/if}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<span class="text-lg font-semibold {account.computed_balance >= 0 ? 'text-income' : 'text-expense'}">
							{formatCurrency(account.computed_balance)}
						</span>
						<button onclick={() => openEdit(account)} class="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary">
							<Pencil size={16} />
						</button>
						<button onclick={() => handleDelete(account.id)} class="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-danger">
							<Trash2 size={16} />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal formulaire -->
{#if showForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0" onclick={() => (showForm = false)}></div>
		<div class="relative w-full max-w-md rounded-xl border border-border bg-bg-secondary p-6 shadow-xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-text-primary">
					{editingId ? 'Modifier le compte' : 'Nouveau compte'}
				</h2>
				<button onclick={() => (showForm = false)} class="text-text-muted hover:text-text-primary">
					<X size={20} />
				</button>
			</div>

			<form onsubmit={handleSubmit} class="space-y-4">
				<div>
					<label for="name" class="mb-1 block text-sm font-medium text-text-secondary">Nom *</label>
					<input
						id="name"
						bind:value={formName}
						required
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
						placeholder="Compte courant principal"
					/>
				</div>

				<div>
					<label for="type" class="mb-1 block text-sm font-medium text-text-secondary">Type</label>
					<select
						id="type"
						bind:value={formType}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
					>
						{#each Object.entries(ACCOUNT_TYPE_LABELS) as [value, label]}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="bank" class="mb-1 block text-sm font-medium text-text-secondary">Banque</label>
						<input
							id="bank"
							bind:value={formBank}
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
							placeholder="Crédit Agricole"
						/>
					</div>
					<div>
						<label for="number" class="mb-1 block text-sm font-medium text-text-secondary">N° compte</label>
						<input
							id="number"
							bind:value={formNumber}
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
							placeholder="XXXX1234"
						/>
					</div>
				</div>

				<div>
					<label for="balance" class="mb-1 block text-sm font-medium text-text-secondary">Solde initial</label>
					<input
						id="balance"
						type="number"
						step="0.01"
						bind:value={formBalance}
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<button type="button" onclick={() => (showForm = false)} class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
						Annuler
					</button>
					<button type="submit" class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
						{editingId ? 'Enregistrer' : 'Créer'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
