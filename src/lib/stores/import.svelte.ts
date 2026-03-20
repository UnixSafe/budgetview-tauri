import { invoke } from '@tauri-apps/api/core';
import type { RawTransaction, ImportPreview, ImportResult, CsvConfig, CsvColumnInfo } from '$lib/types';
import { matchCategory } from '$lib/utils/category-dictionary';
import { query, execute } from './db';

class ImportStore {
	preview = $state<ImportPreview | null>(null);
	loading = $state(false);
	error = $state<string | null>(null);
	filePath = $state<string | null>(null);
	result = $state<ImportResult | null>(null);
	csvConfig = $state<CsvConfig | null>(null);
	csvColumnInfo = $state<CsvColumnInfo | null>(null);

	async loadPreview(filePath: string, csvConfig?: CsvConfig) {
		this.loading = true;
		this.error = null;
		this.filePath = filePath;
		this.result = null;

		try {
			this.preview = await invoke<ImportPreview>('import_preview', {
				filePath,
				csvConfig: csvConfig ?? null
			});
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			this.preview = null;
		} finally {
			this.loading = false;
		}
	}

	async detectCsvColumns(filePath: string) {
		try {
			this.csvColumnInfo = await invoke<CsvColumnInfo>('detect_csv_columns', { filePath });
			this.csvConfig = this.csvColumnInfo.detected_config;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		}
	}

	async confirmImport(accountId: number, skipIndices: number[] = []) {
		if (!this.filePath) return;

		this.loading = true;
		this.error = null;

		try {
			// Merge auto-detected duplicates with manually skipped
			const allSkips = [...(this.preview?.duplicates ?? []), ...skipIndices];
			const uniqueSkips = [...new Set(allSkips)];

			this.result = await invoke<ImportResult>('import_confirm', {
				filePath: this.filePath,
				accountId,
				csvConfig: this.csvConfig ?? null,
				skipIndices: uniqueSkips
			});

			// Post-import: apply dictionary-based categorization on uncategorized transactions
			if (this.result) {
				const dictCategorized = await this.applyDictionaryCategorization(this.result.batch_id);
				if (dictCategorized > 0) {
					this.result.auto_categorized_count += dictCategorized;
				}
			}
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		} finally {
			this.loading = false;
		}
	}

	async rollback(batchId: number): Promise<number> {
		try {
			return await invoke<number>('import_rollback', { batchId });
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			return 0;
		}
	}

	/**
	 * Apply dictionary-based categorization to uncategorized transactions from a batch.
	 * This is a fallback when the learned rules don't match.
	 */
	private async applyDictionaryCategorization(batchId: number): Promise<number> {
		try {
			// Get uncategorized transactions from this batch
			const uncategorized = await query<{ id: number; label: string }>(
				'SELECT id, label FROM transactions WHERE import_batch_id = $1 AND series_id IS NULL',
				[batchId]
			);

			if (uncategorized.length === 0) return 0;

			// Load all series to map names to IDs
			const series = await query<{ id: number; name: string }>(
				'SELECT id, name FROM budget_series WHERE is_active = 1'
			);
			const seriesMap = new Map(series.map(s => [s.name, s.id]));

			let count = 0;
			for (const tx of uncategorized) {
				const categoryName = matchCategory(tx.label);
				if (categoryName) {
					const seriesId = seriesMap.get(categoryName);
					if (seriesId) {
						await execute(
							'UPDATE transactions SET series_id = $1, is_auto_categorized = 1 WHERE id = $2',
							[seriesId, tx.id]
						);
						count++;
					}
				}
			}

			return count;
		} catch {
			return 0;
		}
	}

	reset() {
		this.preview = null;
		this.loading = false;
		this.error = null;
		this.filePath = null;
		this.result = null;
		this.csvConfig = null;
		this.csvColumnInfo = null;
	}
}

export const importStore = new ImportStore();
