import { describe, it, expect } from 'vitest';
import { shiftDateByMonth, effectiveBudgetMonth, isShiftedToOtherMonth } from './budget-shift';

describe('shiftDateByMonth', () => {
	it('décale au mois suivant en conservant le jour', () => {
		expect(shiftDateByMonth('2026-05-15', 1)).toBe('2026-06-15');
	});

	it('décale au mois précédent en conservant le jour', () => {
		expect(shiftDateByMonth('2026-05-15', -1)).toBe('2026-04-15');
	});

	it('gère le passage à l’année suivante', () => {
		expect(shiftDateByMonth('2026-12-15', 1)).toBe('2027-01-15');
	});

	it('gère le passage à l’année précédente', () => {
		expect(shiftDateByMonth('2026-01-15', -1)).toBe('2025-12-15');
	});

	it('clampe le 31 janvier au 28 février (année non bissextile)', () => {
		expect(shiftDateByMonth('2026-01-31', 1)).toBe('2026-02-28');
	});

	it('clampe le 31 janvier au 29 février (année bissextile)', () => {
		expect(shiftDateByMonth('2024-01-31', 1)).toBe('2024-02-29');
	});

	it('clampe le 31 mars au 28 février en arrière', () => {
		expect(shiftDateByMonth('2026-03-31', -1)).toBe('2026-02-28');
	});

	it('clampe le 31 mai au 30 juin', () => {
		expect(shiftDateByMonth('2026-05-31', 1)).toBe('2026-06-30');
	});
});

describe('effectiveBudgetMonth', () => {
	it('retourne le mois de la date réelle sans décalage', () => {
		expect(effectiveBudgetMonth({ date: '2026-05-30', budget_date: null })).toBe('2026-05');
	});

	it('retourne le mois du budget_date quand décalée', () => {
		expect(effectiveBudgetMonth({ date: '2026-05-30', budget_date: '2026-06-30' })).toBe('2026-06');
	});

	it('tolère un budget_date absent (undefined)', () => {
		expect(effectiveBudgetMonth({ date: '2026-05-30' })).toBe('2026-05');
	});
});

describe('isShiftedToOtherMonth', () => {
	it('false sans budget_date', () => {
		expect(isShiftedToOtherMonth({ date: '2026-05-30', budget_date: null })).toBe(false);
	});

	it('false si budget_date dans le même mois', () => {
		expect(isShiftedToOtherMonth({ date: '2026-05-30', budget_date: '2026-05-01' })).toBe(false);
	});

	it('true si budget_date dans un autre mois', () => {
		expect(isShiftedToOtherMonth({ date: '2026-05-30', budget_date: '2026-06-30' })).toBe(true);
	});
});
