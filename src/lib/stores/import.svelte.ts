import { invoke } from '@tauri-apps/api/core';
import type { RawTransaction, ImportPreview, ImportResult, CsvConfig, CsvColumnInfo } from '$lib/types';

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
