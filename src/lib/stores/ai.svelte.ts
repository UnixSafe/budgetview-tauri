import { invoke } from '@tauri-apps/api/core';
import { query } from './db';

export type AiProvider = 'openrouter' | 'xai' | 'none';

interface AiConfig {
	provider: AiProvider;
	model: string;
}

const PROVIDER_ENDPOINTS: Record<string, string> = {
	openrouter: 'https://openrouter.ai/api/v1/chat/completions',
	xai: 'https://api.x.ai/v1/chat/completions',
};

const DEFAULT_MODELS: Record<string, string> = {
	openrouter: 'meta-llama/llama-4-scout',
	xai: 'grok-3-mini',
};

class AiStore {
	provider = $state<AiProvider>('none');
	model = $state('');
	hasKey = $state(false);
	loading = $state(false);
	error = $state<string | null>(null);
	lastResult = $state<string | null>(null);

	async load() {
		try {
			const provider = await invoke<string | null>('get_ai_setting', { key: 'ai_provider' });
			this.provider = (provider as AiProvider) ?? 'none';

			const model = await invoke<string | null>('get_ai_setting', { key: 'ai_model' });
			this.model = model ?? DEFAULT_MODELS[this.provider] ?? '';

			const apiKey = await invoke<string | null>('get_ai_setting', { key: `${this.provider}_api_key` });
			this.hasKey = !!apiKey && apiKey.length > 0;
		} catch {
			this.provider = 'none';
			this.hasKey = false;
		}
	}

	async setProvider(provider: AiProvider) {
		this.provider = provider;
		await invoke('save_ai_setting', { key: 'ai_provider', value: provider });
		this.model = DEFAULT_MODELS[provider] ?? '';
		await invoke('save_ai_setting', { key: 'ai_model', value: this.model });
		// Check if key exists for new provider
		if (provider !== 'none') {
			const apiKey = await invoke<string | null>('get_ai_setting', { key: `${provider}_api_key` });
			this.hasKey = !!apiKey && apiKey.length > 0;
		} else {
			this.hasKey = false;
		}
	}

	async setModel(model: string) {
		this.model = model;
		await invoke('save_ai_setting', { key: 'ai_model', value: model });
	}

	async setApiKey(provider: AiProvider, key: string) {
		await invoke('save_ai_setting', { key: `${provider}_api_key`, value: key });
		this.hasKey = key.length > 0;
	}

	async removeApiKey(provider: AiProvider) {
		await invoke('delete_ai_setting', { key: `${provider}_api_key` });
		this.hasKey = false;
	}

	/**
	 * Categorize a list of transactions using AI.
	 * Returns a map of transaction_id → suggested category name.
	 */
	async categorizeTransactions(
		transactions: { id: number; label: string; amount: number }[]
	): Promise<Map<number, string>> {
		if (this.provider === 'none' || !this.hasKey || transactions.length === 0) {
			return new Map();
		}

		this.loading = true;
		this.error = null;

		try {
			const apiKey = await invoke<string | null>('get_ai_setting', { key: `${this.provider}_api_key` });
			if (!apiKey) throw new Error('Clé API non configurée');

			// Get available categories
			const series = await query<{ name: string }>(
				'SELECT name FROM budget_series WHERE is_active = 1 ORDER BY name'
			);
			const categoryNames = series.map(s => s.name);

			// Build the prompt
			const txList = transactions
				.slice(0, 50) // Limit to 50 transactions per batch
				.map(tx => `- "${tx.label}" (${tx.amount > 0 ? '+' : ''}${(tx.amount / 100).toFixed(2)}€)`)
				.join('\n');

			const systemPrompt = `Tu es un assistant de catégorisation de transactions bancaires françaises.
Voici les catégories disponibles : ${categoryNames.join(', ')}.

Pour chaque transaction, réponds UNIQUEMENT avec un JSON array contenant des objets {"id": <id>, "category": "<nom exact de la catégorie>"}.
Si tu ne peux pas déterminer la catégorie, utilise null pour la valeur category.
Ne réponds avec RIEN d'autre que le JSON.`;

			const userPrompt = `Catégorise ces transactions :\n${transactions.slice(0, 50).map((tx, i) => `${tx.id}: "${tx.label}" (${tx.amount > 0 ? '+' : ''}${(tx.amount / 100).toFixed(2)}€)`).join('\n')}`;

			const endpoint = PROVIDER_ENDPOINTS[this.provider];
			if (!endpoint) throw new Error('Provider non supporté');

			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			};

			// OpenRouter-specific headers
			if (this.provider === 'openrouter') {
				headers['HTTP-Referer'] = 'https://budgetview.fr';
				headers['X-Title'] = 'BudgetView';
			}

			const response = await fetch(endpoint, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					model: this.model,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userPrompt },
					],
					temperature: 0.1,
					max_tokens: 2000,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`API ${this.provider}: ${response.status} - ${errorText.slice(0, 200)}`);
			}

			const data = await response.json();
			const content = data.choices?.[0]?.message?.content ?? '';
			this.lastResult = content;

			// Parse JSON response
			const jsonMatch = content.match(/\[[\s\S]*\]/);
			if (!jsonMatch) return new Map();

			const results: { id: number; category: string | null }[] = JSON.parse(jsonMatch[0]);
			const resultMap = new Map<number, string>();

			for (const r of results) {
				if (r.category && categoryNames.includes(r.category)) {
					resultMap.set(r.id, r.category);
				}
			}

			return resultMap;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			return new Map();
		} finally {
			this.loading = false;
		}
	}
}

export const aiStore = new AiStore();
