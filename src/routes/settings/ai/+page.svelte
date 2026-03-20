<script lang="ts">
	import { onMount } from 'svelte';
	import { Brain, Key, Check, X, Trash2, Zap, Eye, EyeOff, AlertTriangle } from 'lucide-svelte';
	import { aiStore, type AiProvider } from '$lib/stores/ai.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';

	let apiKeyInput = $state('');
	let showApiKey = $state(false);
	let saving = $state(false);
	let testing = $state(false);
	let testResult = $state<'success' | 'error' | null>(null);
	let testMessage = $state('');

	const PROVIDERS = [
		{
			id: 'none' as AiProvider,
			name: 'Désactivé',
			description: 'Pas de catégorisation IA',
			icon: '⊘',
			color: 'text-text-muted',
			bg: 'bg-bg-elevated',
		},
		{
			id: 'openrouter' as AiProvider,
			name: 'OpenRouter',
			description: 'Accès à des centaines de modèles (Llama, Mistral, Claude...)',
			icon: '🌐',
			color: 'text-purple',
			bg: 'bg-purple/10',
			docsUrl: 'https://openrouter.ai/keys',
			models: [
				{ id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout (gratuit)' },
				{ id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick' },
				{ id: 'mistralai/mistral-small-3.2', name: 'Mistral Small 3.2' },
				{ id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
				{ id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
			],
		},
		{
			id: 'xai' as AiProvider,
			name: 'xAI (Grok)',
			description: 'Modèles Grok de xAI',
			icon: '𝕏',
			color: 'text-text-primary',
			bg: 'bg-bg-elevated',
			docsUrl: 'https://console.x.ai/',
			models: [
				{ id: 'grok-3-mini', name: 'Grok 3 Mini (rapide)' },
				{ id: 'grok-3', name: 'Grok 3' },
				{ id: 'grok-4', name: 'Grok 4' },
			],
		},
	];

	onMount(() => { aiStore.load(); });

	async function handleSaveKey() {
		if (!apiKeyInput.trim()) return;
		saving = true;
		try {
			await aiStore.setApiKey(aiStore.provider, apiKeyInput.trim());
			toastStore.success('Clé API enregistrée de manière sécurisée');
			apiKeyInput = '';
			testResult = null;
		} catch (e) {
			toastStore.error(String(e));
		} finally {
			saving = false;
		}
	}

	async function handleRemoveKey() {
		if (!confirm('Supprimer la clé API ?')) return;
		await aiStore.removeApiKey(aiStore.provider);
		toastStore.success('Clé API supprimée');
		testResult = null;
	}

	async function handleTestConnection() {
		testing = true;
		testResult = null;
		try {
			const result = await aiStore.categorizeTransactions([
				{ id: 0, label: 'CB CARREFOUR PARIS', amount: -4520 },
				{ id: 1, label: 'VIR SEPA SALAIRE', amount: 280000 },
			]);
			if (result.size > 0) {
				testResult = 'success';
				testMessage = `Connexion OK — ${result.size} transaction(s) catégorisée(s) : ${Array.from(result.values()).join(', ')}`;
			} else if (aiStore.error) {
				testResult = 'error';
				testMessage = aiStore.error;
			} else {
				testResult = 'success';
				testMessage = 'Connexion OK (aucune catégorie suggérée pour le test)';
			}
		} catch (e) {
			testResult = 'error';
			testMessage = String(e);
		} finally {
			testing = false;
		}
	}

	let selectedProvider = $derived(PROVIDERS.find(p => p.id === aiStore.provider));
</script>

<svelte:head>
	<title>Intelligence artificielle — BudgetView</title>
</svelte:head>

<div class="space-y-8 animate-fade-in">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary">Intelligence artificielle</h1>
		<p class="mt-1 text-sm text-text-muted">Catégorisation automatique par IA de vos transactions</p>
	</div>

	<!-- Provider selection -->
	<div class="glass-card p-7">
		<div class="mb-6 flex items-center gap-4">
			<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12">
				<Brain size={22} class="text-accent" strokeWidth={1.8} />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-text-primary">Fournisseur IA</h2>
				<p class="text-[13px] text-text-muted">Choisissez le service d'IA pour la catégorisation</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
			{#each PROVIDERS as provider}
				<button
					onclick={() => { aiStore.setProvider(provider.id); apiKeyInput = ''; testResult = null; }}
					class="relative rounded-2xl border p-5 text-left transition-smooth btn-press
						{aiStore.provider === provider.id ? 'border-accent bg-accent/5 ring-1 ring-accent/20' : 'border-border hover:bg-bg-hover'}"
				>
					{#if aiStore.provider === provider.id}
						<div class="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
							<Check size={12} class="text-white" strokeWidth={3} />
						</div>
					{/if}
					<span class="text-2xl mb-3 block">{provider.icon}</span>
					<p class="text-[14px] font-semibold text-text-primary">{provider.name}</p>
					<p class="mt-1 text-[12px] text-text-muted">{provider.description}</p>
				</button>
			{/each}
		</div>
	</div>

	<!-- API Key configuration -->
	{#if aiStore.provider !== 'none' && selectedProvider}
		<div class="glass-card p-7 animate-slide-up">
			<div class="mb-6 flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/12">
					<Key size={22} class="text-warning" strokeWidth={1.8} />
				</div>
				<div>
					<h2 class="text-lg font-semibold text-text-primary">Clé API {selectedProvider.name}</h2>
					<p class="text-[13px] text-text-muted">
						Stockée de manière chiffrée localement
						{#if selectedProvider.docsUrl}
							— <a href={selectedProvider.docsUrl} target="_blank" rel="noopener" class="text-accent hover:text-accent-hover">Obtenir une clé</a>
						{/if}
					</p>
				</div>
			</div>

			{#if aiStore.hasKey}
				<div class="mb-5 flex items-center gap-3 rounded-xl bg-income/8 px-4 py-3">
					<Check size={16} class="text-income" />
					<span class="text-[13px] font-medium text-income">Clé API configurée</span>
					<button
						onclick={handleRemoveKey}
						class="ml-auto rounded-lg p-1.5 text-income/50 hover:text-danger hover:bg-danger/10 transition-smooth"
						title="Supprimer la clé"
					>
						<Trash2 size={14} />
					</button>
				</div>
			{/if}

			<div class="flex gap-3">
				<div class="relative flex-1">
					<input
						type={showApiKey ? 'text' : 'password'}
						bind:value={apiKeyInput}
						placeholder={aiStore.hasKey ? 'Remplacer la clé existante...' : 'sk-...'}
						class="w-full rounded-xl border border-border bg-bg-input px-4 py-3 pr-10 text-[13px] text-text-primary outline-none focus-ring placeholder:text-text-muted font-mono"
					/>
					<button
						type="button"
						onclick={() => (showApiKey = !showApiKey)}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/50 hover:text-text-secondary transition-smooth"
					>
						{#if showApiKey}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
					</button>
				</div>
				<button
					onclick={handleSaveKey}
					disabled={saving || !apiKeyInput.trim()}
					class="rounded-xl bg-accent px-5 py-3 text-[13px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover disabled:opacity-40"
				>
					{saving ? '...' : 'Enregistrer'}
				</button>
			</div>

			<div class="mt-3 flex items-start gap-2 text-[11px] text-text-muted/70">
				<AlertTriangle size={12} class="shrink-0 mt-0.5" />
				<p>Votre clé API est chiffrée avant d'être stockée dans la base de données locale. Elle ne quitte jamais votre ordinateur sauf pour les appels à l'API.</p>
			</div>
		</div>

		<!-- Model selection -->
		<div class="glass-card p-7 animate-slide-up" style="animation-delay: 60ms;">
			<div class="mb-5">
				<h2 class="text-[15px] font-semibold text-text-primary">Modèle</h2>
				<p class="mt-1 text-[13px] text-text-muted">Choisissez le modèle d'IA à utiliser</p>
			</div>

			{#if selectedProvider.models}
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each selectedProvider.models as m}
						<button
							onclick={() => aiStore.setModel(m.id)}
							class="rounded-xl border px-4 py-3 text-left transition-smooth btn-press
								{aiStore.model === m.id ? 'border-accent bg-accent/5' : 'border-border hover:bg-bg-hover'}"
						>
							<p class="text-[13px] font-medium text-text-primary">{m.name}</p>
							<p class="text-[11px] text-text-muted font-mono mt-0.5">{m.id}</p>
						</button>
					{/each}
				</div>
			{/if}

			<div class="mt-4">
				<label for="custom-model" class="mb-1.5 block text-[12px] font-medium text-text-muted">Ou saisir un ID de modèle personnalisé :</label>
				<input
					id="custom-model"
					type="text"
					value={aiStore.model}
					onchange={(e) => aiStore.setModel((e.target as HTMLInputElement).value)}
					class="w-full rounded-xl border border-border bg-bg-input px-4 py-2.5 text-[13px] text-text-primary outline-none focus-ring font-mono placeholder:text-text-muted"
					placeholder="organisation/model-name"
				/>
			</div>
		</div>

		<!-- Test connection -->
		{#if aiStore.hasKey}
			<div class="glass-card p-7 animate-slide-up" style="animation-delay: 120ms;">
				<div class="mb-5">
					<h2 class="text-[15px] font-semibold text-text-primary">Test de connexion</h2>
					<p class="mt-1 text-[13px] text-text-muted">Vérifiez que la clé API fonctionne avec 2 transactions test</p>
				</div>

				<button
					onclick={handleTestConnection}
					disabled={testing}
					class="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-[14px] font-semibold text-white transition-smooth btn-press hover:bg-accent-hover shadow-lg shadow-accent/20 disabled:opacity-40"
				>
					{#if testing}
						<div class="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
						Test en cours...
					{:else}
						<Zap size={16} />
						Tester la connexion
					{/if}
				</button>

				{#if testResult}
					<div class="mt-4 rounded-xl px-4 py-3 text-[13px] {testResult === 'success' ? 'bg-income/8 text-income' : 'bg-danger/8 text-danger'} animate-slide-up">
						{#if testResult === 'success'}
							<Check size={14} class="inline mr-1" />
						{:else}
							<AlertTriangle size={14} class="inline mr-1" />
						{/if}
						{testMessage}
					</div>
				{/if}
			</div>
		{/if}
	{/if}

	<!-- How it works -->
	<div class="glass-card p-7">
		<h2 class="text-[15px] font-semibold text-text-primary mb-4">Comment ça fonctionne</h2>
		<div class="space-y-3 text-[13px] text-text-secondary">
			<div class="flex items-start gap-3">
				<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-[11px] font-bold text-text-muted">1</span>
				<p><strong class="text-text-primary">Règles apprises</strong> — Quand vous catégorisez 3+ fois le même libellé, BudgetView l'apprend automatiquement.</p>
			</div>
			<div class="flex items-start gap-3">
				<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-[11px] font-bold text-text-muted">2</span>
				<p><strong class="text-text-primary">Dictionnaire mots-clés</strong> — 170+ mots-clés français pré-configurés (CARREFOUR → Courses, SHELL → Carburant...).</p>
			</div>
			<div class="flex items-start gap-3">
				<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">3</span>
				<p><strong class="text-accent">IA (optionnel)</strong> — Les transactions non reconnues sont envoyées à l'IA qui propose une catégorie. Nécessite une connexion internet.</p>
			</div>
		</div>
	</div>
</div>
