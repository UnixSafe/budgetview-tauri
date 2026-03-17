use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// === Types ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawTransaction {
    pub date: String,
    pub label: String,
    pub original_label: String,
    pub amount: f64,
    pub note: Option<String>,
    pub fitid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreview {
    pub format: String,
    pub account_number: Option<String>,
    pub bank_id: Option<String>,
    pub transactions: Vec<RawTransaction>,
    pub duplicates: Vec<usize>,
    pub total_count: usize,
    pub new_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub batch_id: i64,
    pub imported_count: usize,
    pub duplicates_skipped: usize,
    pub account_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvConfig {
    pub delimiter: char,
    pub date_column: usize,
    pub label_column: usize,
    pub amount_column: usize,
    pub debit_column: Option<usize>,
    pub credit_column: Option<usize>,
    pub date_format: String,
    pub skip_lines: usize,
    pub decimal_separator: char,
}

impl Default for CsvConfig {
    fn default() -> Self {
        Self {
            delimiter: ';',
            date_column: 0,
            label_column: 1,
            amount_column: 2,
            debit_column: None,
            credit_column: None,
            date_format: "%d/%m/%Y".to_string(),
            skip_lines: 0,
            decimal_separator: ',',
        }
    }
}

// === Format Detection ===

pub fn detect_format(content: &str) -> &'static str {
    let upper = content.to_uppercase();
    if upper.contains("OFXHEADER") || upper.contains("<OFX>") {
        "ofx"
    } else if upper.contains("!TYPE:") || upper.contains("!ACCOUNT") {
        "qif"
    } else {
        "csv"
    }
}

// === OFX Parser ===
// Handles both SGML (v1.x) and XML (v2.x) OFX formats

pub fn parse_ofx(content: &str) -> Result<(Vec<RawTransaction>, Option<String>, Option<String>), String> {
    let mut transactions = Vec::new();
    let mut account_number: Option<String> = None;
    let mut bank_id: Option<String> = None;

    // Extract account info
    if let Some(acctid) = extract_ofx_tag(content, "ACCTID") {
        account_number = Some(acctid.trim().to_string());
    }
    if let Some(bankid) = extract_ofx_tag(content, "BANKID") {
        bank_id = Some(bankid.trim().to_string());
    }

    // Find all STMTTRN blocks
    let upper = content.to_uppercase();
    let mut search_from = 0;

    loop {
        let start = match upper[search_from..].find("<STMTTRN>") {
            Some(pos) => search_from + pos,
            None => break,
        };
        let end = match upper[start..].find("</STMTTRN>") {
            Some(pos) => start + pos + "</STMTTRN>".len(),
            None => {
                // SGML style: no closing tag, find next STMTTRN or end of BANKTRANLIST
                match upper[start + 9..].find("<STMTTRN>") {
                    Some(pos) => start + 9 + pos,
                    None => match upper[start..].find("</BANKTRANLIST>") {
                        Some(pos) => start + pos,
                        None => content.len(),
                    },
                }
            }
        };

        let block = &content[start..end];

        let date_str = extract_ofx_tag(block, "DTPOSTED")
            .unwrap_or_default()
            .trim()
            .to_string();
        let amount_str = extract_ofx_tag(block, "TRNAMT")
            .unwrap_or_default()
            .trim()
            .to_string();
        let name = extract_ofx_tag(block, "NAME")
            .unwrap_or_default()
            .trim()
            .to_string();
        let memo = extract_ofx_tag(block, "MEMO").map(|s| s.trim().to_string());
        let fitid = extract_ofx_tag(block, "FITID").map(|s| s.trim().to_string());

        // Parse date: YYYYMMDD or YYYYMMDDHHMMSS
        let date = parse_ofx_date(&date_str).unwrap_or_else(|| date_str.clone());

        // Parse amount
        let amount: f64 = amount_str
            .replace(',', ".")
            .parse()
            .unwrap_or(0.0);

        let label = clean_label(&name);

        if !label.is_empty() || amount != 0.0 {
            transactions.push(RawTransaction {
                date,
                label: label.clone(),
                original_label: name,
                amount,
                note: memo,
                fitid,
            });
        }

        search_from = end;
    }

    Ok((transactions, account_number, bank_id))
}

fn extract_ofx_tag(content: &str, tag: &str) -> Option<String> {
    let upper_content = content.to_uppercase();
    let open_tag = format!("<{}>", tag.to_uppercase());
    let close_tag = format!("</{}>", tag.to_uppercase());

    if let Some(start) = upper_content.find(&open_tag) {
        let value_start = start + open_tag.len();
        // Check for closing tag
        let value_end = if let Some(close_pos) = upper_content[value_start..].find(&close_tag) {
            value_start + close_pos
        } else {
            // SGML: value ends at next < or newline
            let remaining = &content[value_start..];
            let end = remaining
                .find('<')
                .unwrap_or_else(|| remaining.find('\n').unwrap_or(remaining.len()));
            value_start + end
        };
        Some(content[value_start..value_end].to_string())
    } else {
        None
    }
}

fn parse_ofx_date(s: &str) -> Option<String> {
    if s.len() >= 8 {
        let year = &s[0..4];
        let month = &s[4..6];
        let day = &s[6..8];
        // Validate
        if let Ok(d) = NaiveDate::parse_from_str(&format!("{}-{}-{}", year, month, day), "%Y-%m-%d") {
            return Some(d.format("%Y-%m-%d").to_string());
        }
    }
    None
}

// === QIF Parser ===

pub fn parse_qif(content: &str) -> Result<Vec<RawTransaction>, String> {
    let mut transactions = Vec::new();
    let mut current_date = String::new();
    let mut current_amount = 0.0;
    let mut current_label = String::new();
    let mut current_memo: Option<String> = None;
    let mut in_transaction = false;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Skip header lines
        if line.starts_with('!') {
            continue;
        }

        // Record separator
        if line == "^" {
            if in_transaction && !current_label.is_empty() {
                transactions.push(RawTransaction {
                    date: current_date.clone(),
                    label: clean_label(&current_label),
                    original_label: current_label.clone(),
                    amount: current_amount,
                    note: current_memo.clone(),
                    fitid: None,
                });
            }
            // Reset
            current_date.clear();
            current_amount = 0.0;
            current_label.clear();
            current_memo = None;
            in_transaction = false;
            continue;
        }

        let (code, value) = (line.chars().next().unwrap_or(' '), &line[1..]);

        match code {
            'D' => {
                current_date = parse_qif_date(value.trim());
                in_transaction = true;
            }
            'T' | 'U' => {
                let cleaned = value.trim().replace(',', ".").replace(' ', "");
                current_amount = cleaned.parse().unwrap_or(0.0);
                in_transaction = true;
            }
            'P' => {
                current_label = value.trim().to_string();
                in_transaction = true;
            }
            'M' => {
                current_memo = Some(value.trim().to_string());
            }
            'N' | 'L' | 'C' | 'A' => {
                // N=check number, L=category, C=cleared, A=address — skip
                in_transaction = true;
            }
            _ => {}
        }
    }

    // Handle last transaction if no trailing ^
    if in_transaction && !current_label.is_empty() {
        transactions.push(RawTransaction {
            date: current_date,
            label: clean_label(&current_label),
            original_label: current_label,
            amount: current_amount,
            note: current_memo,
            fitid: None,
        });
    }

    Ok(transactions)
}

fn parse_qif_date(s: &str) -> String {
    // Try common QIF date formats
    // French: DD/MM/YYYY or DD/MM/YY
    // US: MM/DD/YYYY or M/D/YY
    // Also: DD-MM-YYYY, DD.MM.YYYY

    let cleaned = s.replace(['-', '.'], "/");
    let parts: Vec<&str> = cleaned.split('/').collect();

    if parts.len() == 3 {
        let a: u32 = parts[0].parse().unwrap_or(0);
        let b: u32 = parts[1].parse().unwrap_or(0);
        let mut c: u32 = parts[2].trim_matches('\'').parse().unwrap_or(0);

        // Handle 2-digit year
        if c < 100 {
            c += if c > 70 { 1900 } else { 2000 };
        }

        // Determine if DD/MM/YYYY (French) or MM/DD/YYYY (US)
        // Heuristic: if first number > 12, it's the day (French format)
        let (day, month, year) = if a > 12 {
            (a, b, c)
        } else if b > 12 {
            (b, a, c)
        } else {
            // Ambiguous — assume French (DD/MM/YYYY)
            (a, b, c)
        };

        if let Some(d) = NaiveDate::from_ymd_opt(year as i32, month, day) {
            return d.format("%Y-%m-%d").to_string();
        }
    }

    s.to_string()
}

// === CSV Parser ===

pub fn parse_csv(content: &str, config: &CsvConfig) -> Result<Vec<RawTransaction>, String> {
    let mut transactions = Vec::new();

    let delimiter = config.delimiter as u8;
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .has_headers(true)
        .from_reader(content.as_bytes());

    // Skip extra header lines if configured
    // (csv crate already skips one header line)

    for result in reader.records() {
        let record = result.map_err(|e| format!("Erreur CSV ligne: {}", e))?;

        let date_str = record.get(config.date_column).unwrap_or("").trim();
        let label_str = record.get(config.label_column).unwrap_or("").trim();

        if date_str.is_empty() || label_str.is_empty() {
            continue;
        }

        let amount = if let (Some(debit_col), Some(credit_col)) = (config.debit_column, config.credit_column) {
            // Separate debit/credit columns
            let debit = parse_french_number(record.get(debit_col).unwrap_or(""), config.decimal_separator);
            let credit = parse_french_number(record.get(credit_col).unwrap_or(""), config.decimal_separator);
            credit - debit
        } else {
            parse_french_number(record.get(config.amount_column).unwrap_or(""), config.decimal_separator)
        };

        // Parse date
        let date = parse_csv_date(date_str, &config.date_format);

        let label = clean_label(label_str);

        transactions.push(RawTransaction {
            date,
            label: label.clone(),
            original_label: label_str.to_string(),
            amount,
            note: None,
            fitid: None,
        });
    }

    Ok(transactions)
}

/// Auto-detect CSV configuration from content
pub fn detect_csv_config(content: &str) -> CsvConfig {
    let mut config = CsvConfig::default();

    // Detect delimiter
    let first_lines: Vec<&str> = content.lines().take(5).collect();
    if let Some(header) = first_lines.first() {
        let semicolons = header.matches(';').count();
        let commas = header.matches(',').count();
        let tabs = header.matches('\t').count();

        if tabs > semicolons && tabs > commas {
            config.delimiter = '\t';
        } else if commas > semicolons {
            config.delimiter = ',';
            config.decimal_separator = '.';
        }
        // default is ';' with ',' decimal (French)
    }

    // Try to detect columns from header
    if let Some(header) = first_lines.first() {
        let cols: Vec<String> = header
            .split(config.delimiter)
            .map(|s| s.trim().trim_matches('"').to_uppercase())
            .collect();

        let col_map: HashMap<usize, &str> = cols.iter().enumerate().map(|(i, s)| (i, s.as_str())).collect();

        for (i, name) in &col_map {
            if name.contains("DATE") && !name.contains("VALEUR") && !name.contains("VALUE") {
                config.date_column = *i;
            } else if name.contains("LIBEL") || name.contains("LABEL") || name.contains("DESCR") || *name == "LIBELLÉ" {
                config.label_column = *i;
            } else if name.contains("MONTANT") || name.contains("AMOUNT") {
                config.amount_column = *i;
            } else if name.contains("DEBIT") || name.contains("DÉBIT") {
                config.debit_column = Some(*i);
            } else if name.contains("CREDIT") || name.contains("CRÉDIT") {
                config.credit_column = Some(*i);
            }
        }
    }

    // Detect date format from first data line
    if let Some(data_line) = first_lines.get(1) {
        let cols: Vec<&str> = data_line.split(config.delimiter).collect();
        if let Some(date_str) = cols.get(config.date_column) {
            let date_str = date_str.trim().trim_matches('"');
            if date_str.contains('/') {
                let parts: Vec<&str> = date_str.split('/').collect();
                if parts.len() == 3 {
                    if parts[2].len() == 4 && parts[0].len() <= 2 {
                        config.date_format = "%d/%m/%Y".to_string();
                    } else if parts[0].len() == 4 {
                        config.date_format = "%Y/%m/%d".to_string();
                    }
                }
            } else if date_str.contains('-') {
                config.date_format = "%Y-%m-%d".to_string();
            }
        }
    }

    config
}

fn parse_french_number(s: &str, decimal_sep: char) -> f64 {
    let cleaned = s
        .trim()
        .trim_matches('"')
        .replace('\u{a0}', "") // non-breaking space
        .replace(' ', "");

    if cleaned.is_empty() {
        return 0.0;
    }

    let normalized = if decimal_sep == ',' {
        // French: 1.234,56 or 1234,56
        cleaned.replace('.', "").replace(',', ".")
    } else {
        // English: 1,234.56 or 1234.56
        cleaned.replace(',', "")
    };

    normalized.parse().unwrap_or(0.0)
}

fn parse_csv_date(s: &str, format: &str) -> String {
    let cleaned = s.trim().trim_matches('"');
    if let Ok(d) = NaiveDate::parse_from_str(cleaned, format) {
        d.format("%Y-%m-%d").to_string()
    } else {
        // Fallback: try common formats
        for fmt in &["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d.%m.%Y"] {
            if let Ok(d) = NaiveDate::parse_from_str(cleaned, fmt) {
                return d.format("%Y-%m-%d").to_string();
            }
        }
        cleaned.to_string()
    }
}

// === Helpers ===

fn clean_label(s: &str) -> String {
    // Normalize whitespace, trim, title-case-ish
    let cleaned: String = s
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    cleaned.trim().to_string()
}

// === Dedup ===

/// Check which transaction indices are duplicates based on FITID or (date, amount, label) matching
pub fn find_duplicate_indices(
    new_txs: &[RawTransaction],
    existing_fitids: &[String],
    existing_hashes: &[(String, i64, String)], // (date, amount_cents, label)
) -> Vec<usize> {
    let fitid_set: std::collections::HashSet<&str> = existing_fitids.iter().map(|s| s.as_str()).collect();
    let hash_set: std::collections::HashSet<String> = existing_hashes
        .iter()
        .map(|(d, a, l)| format!("{}|{}|{}", d, a, l.to_uppercase()))
        .collect();

    let mut duplicates = Vec::new();
    for (i, tx) in new_txs.iter().enumerate() {
        // Check FITID first (most reliable)
        if let Some(ref fitid) = tx.fitid {
            if fitid_set.contains(fitid.as_str()) {
                duplicates.push(i);
                continue;
            }
        }
        // Fallback: fuzzy match on date + amount (cents) + normalized label
        let amount_cents = (tx.amount * 100.0).round() as i64;
        let hash = format!("{}|{}|{}", tx.date, amount_cents, tx.label.to_uppercase());
        if hash_set.contains(&hash) {
            duplicates.push(i);
        }
    }
    duplicates
}

/// Read file with encoding detection (handles ISO-8859-1 common in French bank exports)
pub fn read_file_with_encoding(path: &str) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("Impossible de lire le fichier: {}", e))?;

    // Try UTF-8 first
    if let Ok(s) = String::from_utf8(bytes.clone()) {
        return Ok(s);
    }

    // Fallback: try ISO-8859-1 (Latin-1), common in French bank exports
    let (decoded, _, had_errors) = encoding_rs::WINDOWS_1252.decode(&bytes);
    if !had_errors {
        return Ok(decoded.into_owned());
    }

    // Last resort: lossy UTF-8
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}
