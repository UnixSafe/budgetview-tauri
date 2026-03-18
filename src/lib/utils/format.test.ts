import { describe, it, expect } from 'vitest';
import {
	toCents,
	toEuros,
	formatCurrency,
	formatDate,
	formatMonth,
	anonymizeLabel,
	isExcludedFromAutoCategorization,
	isTransferLabel
} from './format';

describe('toCents', () => {
	it('converts euros to centimes', () => {
		expect(toCents(12.34)).toBe(1234);
		expect(toCents(0)).toBe(0);
		expect(toCents(-50.5)).toBe(-5050);
	});

	it('rounds correctly', () => {
		// 1.005 * 100 = 100.49999... in IEEE 754, rounds to 100
		expect(toCents(1.005)).toBe(100);
		expect(toCents(99.99)).toBe(9999);
	});
});

describe('toEuros', () => {
	it('converts centimes to euros', () => {
		expect(toEuros(1234)).toBe(12.34);
		expect(toEuros(0)).toBe(0);
		expect(toEuros(-5050)).toBe(-50.5);
	});
});

describe('anonymizeLabel', () => {
	it('removes date patterns', () => {
		expect(anonymizeLabel('CARTE 17/03 CARREFOUR')).toBe('CARTE CARREFOUR');
		expect(anonymizeLabel('PRLV 15/03/2024 EDF')).toBe('PRLV EDF');
	});

	it('removes long digit sequences (4+)', () => {
		expect(anonymizeLabel('CB 1234 5678')).toBe('CB');
		expect(anonymizeLabel('CHEQUE 123456')).toBe('CHEQUE');
	});

	it('keeps mixed alphanumeric words', () => {
		expect(anonymizeLabel('3SUISSES PARIS')).toBe('3SUISSES PARIS');
		expect(anonymizeLabel('LIDL2GO')).toBe('LIDL2GO');
		expect(anonymizeLabel('CB*1234')).toBe('CB*1234');
	});

	it('keeps short numbers (1-3 digits)', () => {
		expect(anonymizeLabel('PARIS 13')).toBe('PARIS 13');
		expect(anonymizeLabel('LOT 42')).toBe('LOT 42');
	});

	it('converts to uppercase', () => {
		expect(anonymizeLabel('carrefour market')).toBe('CARREFOUR MARKET');
	});

	it('handles complex real-world labels', () => {
		expect(anonymizeLabel('CARTE 17/03 CARREFOUR CB*1234 5678')).toBe('CARTE CARREFOUR CB*1234');
		expect(anonymizeLabel('PRLV 15/03/2024 EDF 123456')).toBe('PRLV EDF');
	});
});

describe('formatCurrency', () => {
	it('formats positive amounts', () => {
		const result = formatCurrency(123400);
		// Amount is in cents, should format as 1 234,00 €
		expect(result).toContain('1');
		expect(result).toContain('234');
	});

	it('formats negative amounts', () => {
		const result = formatCurrency(-50000);
		expect(result).toContain('500');
	});

	it('formats zero', () => {
		const result = formatCurrency(0);
		expect(result).toContain('0');
	});
});

describe('formatDate', () => {
	it('formats ISO date strings', () => {
		const result = formatDate('2026-03-18');
		expect(result).toContain('18');
		expect(result).toContain('03');
	});
});

describe('formatMonth', () => {
	it('formats year and month', () => {
		const result = formatMonth(2026, 3);
		expect(result.toLowerCase()).toContain('mars');
		expect(result).toContain('2026');
	});

	it('handles January', () => {
		const result = formatMonth(2026, 1);
		expect(result.toLowerCase()).toContain('janvier');
	});

	it('handles December', () => {
		const result = formatMonth(2026, 12);
		expect(result.toLowerCase()).toContain('décembre');
	});
});

describe('toCents edge cases', () => {
	it('handles very small amounts', () => {
		expect(toCents(0.01)).toBe(1);
		expect(toCents(-0.01)).toBe(-1);
	});

	it('handles large amounts', () => {
		expect(toCents(99999.99)).toBe(9999999);
	});
});

describe('anonymizeLabel edge cases', () => {
	it('handles empty string', () => {
		expect(anonymizeLabel('')).toBe('');
	});

	it('handles string with only numbers', () => {
		expect(anonymizeLabel('12345678')).toBe('');
	});

	it('handles string with only date', () => {
		expect(anonymizeLabel('17/03/2026')).toBe('');
	});

	it('preserves reference codes with mixed chars', () => {
		expect(anonymizeLabel('REF-ABC123')).toBe('REF-ABC123');
	});
});

describe('isTransferLabel', () => {
	it('detects VIR SEPA', () => {
		expect(isTransferLabel('VIR SEPA EPARGNE')).toBe(true);
		expect(isTransferLabel('VIR EMIS VERS LIVRET')).toBe(true);
		expect(isTransferLabel('VIR RECU DE COMPTE JOINT')).toBe(true);
	});

	it('detects VIREMENT', () => {
		expect(isTransferLabel('VIREMENT INTERNE')).toBe(true);
		expect(isTransferLabel('Virement permanent')).toBe(true);
	});

	it('does not match normal transactions', () => {
		expect(isTransferLabel('CARREFOUR CB')).toBe(false);
		expect(isTransferLabel('PRLV EDF')).toBe(false);
		expect(isTransferLabel('SALAIRE MARS')).toBe(false);
	});
});

describe('isExcludedFromAutoCategorization', () => {
	it('excludes cheques', () => {
		expect(isExcludedFromAutoCategorization('CHEQUE 12345')).toBe(true);
		expect(isExcludedFromAutoCategorization('chèque n°456')).toBe(true);
		expect(isExcludedFromAutoCategorization('CHQ 789')).toBe(true);
	});

	it('excludes cash withdrawals', () => {
		expect(isExcludedFromAutoCategorization('Retrait DAB 50€')).toBe(true);
		expect(isExcludedFromAutoCategorization('RETRAIT GAB')).toBe(true);
	});

	it('excludes cash deposits', () => {
		expect(isExcludedFromAutoCategorization('Remise esp')).toBe(true);
		expect(isExcludedFromAutoCategorization('DEPOT ESP')).toBe(true);
		expect(isExcludedFromAutoCategorization('VERSEMENT ESP')).toBe(true);
	});

	it('does not exclude normal transactions', () => {
		expect(isExcludedFromAutoCategorization('CARREFOUR CB')).toBe(false);
		expect(isExcludedFromAutoCategorization('VIR SEPA SALAIRE')).toBe(false);
		expect(isExcludedFromAutoCategorization('PRLV EDF')).toBe(false);
	});
});
