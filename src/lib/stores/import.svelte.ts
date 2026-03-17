import { invoke } from '@tauri-apps/api/core';

export interface RawTransaction {
	date: string;
	label: string;
	original_label: string;
	amount: number;
	note: string | null;
	fitid: string | null;
}

export interface ImportPreview {
	format: string;
	account_number: string | null;
	bank_id: string | null;
	transactions: RawTransaction[];
	duplicates: number[];
	total_count: number;
	new_count: number;
}

export interface ImportResult {
	batch_id: number;
	imported_count: number;
	duplicates_skipped: number;
	account_id: number;
}

export interface CsvConfig {
	delimiter: string;
	date_column: number;
	label_column: number;
	amount_column: number;
	debit_column: number | null;
	credit_column: number | null;
	date_format: string;
	skip_lines: number;
	decimal_separator: string;
}

export interface CsvColumnInfo {
	headers: string[];
	sample_rows: string[][];
	detected_config: CsvConfig;
}

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
