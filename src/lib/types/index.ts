// === Comptes ===
export interface Account {
	id: number;
	name: string;
	account_number: string | null;
	bank_name: string | null;
	account_type: 'checking' | 'savings' | 'credit_card' | 'cash';
	currency: string;
	initial_balance: number;
	is_active: boolean;
	created_at: string;
}

export type AccountType = Account['account_type'];

// === Budget Series (catégories) ===
export type BudgetArea = 'income' | 'recurring' | 'variable' | 'extras' | 'savings' | 'transfers';

export interface BudgetSeries {
	id: number;
	name: string;
	budget_area: BudgetArea;
	target_amount: number | null;
	day_of_month: number | null;
	is_active: boolean;
	description: string | null;
}

export interface SubSeries {
	id: number;
	series_id: number;
	name: string;
}

// === Transactions ===
export interface Transaction {
	id: number;
	account_id: number;
	date: string;
	label: string;
	original_label: string | null;
	amount: number;
	note: string | null;
	is_planned: boolean;
	series_id: number | null;
	sub_series_id: number | null;
	import_batch_id: number | null;
	fitid: string | null;
	label_for_categorization: string | null;
	is_auto_categorized: boolean;
	created_at: string;
	// Joined fields
	account_name?: string;
	series_name?: string;
}

// === Budget mensuel ===
export interface MonthlyBudget {
	id: number;
	series_id: number;
	year: number;
	month: number;
	planned_amount: number;
}

// === Budget view (agrégé) ===
export interface BudgetLineItem {
	series_id: number;
	series_name: string;
	budget_area: BudgetArea;
	planned_amount: number;
	actual_amount: number;
}

// === Import ===
export interface ImportBatch {
	id: number;
	filename: string;
	format: 'ofx' | 'qif' | 'csv';
	account_id: number | null;
	transaction_count: number;
	imported_at: string;
}

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
	auto_categorized_count: number;
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

// === Catégorisation ===
export interface CategorizationRule {
	id: number;
	label_pattern: string;
	series_id: number;
	sub_series_id: number | null;
	match_count: number;
	last_used_at: string;
	// Joined fields
	series_name?: string;
}

// === Projects ===
export interface Project {
	id: number;
	name: string;
	target_amount: number | null;
	target_date: string | null;
	account_id: number | null;
	is_active: boolean;
}

export interface ProjectItem {
	id: number;
	project_id: number;
	label: string;
	planned_amount: number;
	month: number | null;
	year: number | null;
	series_id: number | null;
}

// === Splits (ventilation) ===
export interface Split {
	id: number;
	transaction_id: number;
	series_id: number;
	amount: number; // in cents
	note: string | null;
	created_at: string | null;
	series_name?: string;
}

export interface SplitInput {
	amount_cents: number;
	series_id: number;
	note: string | null;
}

// === Dashboard ===
export interface DashboardSummary {
	total_balance: number;
	month_income: number;
	month_expenses: number;
	transaction_count: number;
}
