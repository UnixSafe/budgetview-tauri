import { describe, it, expect } from 'vitest';

/**
 * Tests for budget calculation logic used across the app.
 * These test the pure functions extracted from budget views.
 */

describe('Budget calculations', () => {
	function progressPercent(planned: number, actual: number, isIncome: boolean): number {
		if (planned === 0) return 0;
		if (isIncome) {
			return Math.min((actual / planned) * 100, 100);
		}
		return Math.min((Math.abs(actual) / Math.abs(planned)) * 100, 150);
	}

	function progressStatus(pct: number, isIncome: boolean): 'ok' | 'warning' | 'over' {
		if (isIncome) return pct >= 100 ? 'ok' : 'warning';
		if (pct > 100) return 'over';
		if (pct > 80) return 'warning';
		return 'ok';
	}

	function dailyBudgetRemaining(totalPlanned: number, totalActual: number, daysLeft: number): number {
		const remaining = totalPlanned - totalActual;
		return remaining / Math.max(daysLeft, 1);
	}

	function monthOverMonthChange(current: number, previous: number): number {
		if (previous === 0) return 0;
		return ((current - previous) / previous) * 100;
	}

	describe('progressPercent', () => {
		it('returns 0 when planned is 0', () => {
			expect(progressPercent(0, -500, false)).toBe(0);
		});

		it('calculates expense progress correctly', () => {
			expect(progressPercent(-1000, -500, false)).toBe(50);
			expect(progressPercent(-1000, -1000, false)).toBe(100);
		});

		it('caps expense progress at 150%', () => {
			expect(progressPercent(-1000, -2000, false)).toBe(150);
		});

		it('calculates income progress correctly', () => {
			expect(progressPercent(3000, 3000, true)).toBe(100);
			expect(progressPercent(3000, 1500, true)).toBe(50);
		});

		it('caps income progress at 100%', () => {
			expect(progressPercent(3000, 5000, true)).toBe(100);
		});
	});

	describe('progressStatus', () => {
		it('returns ok for expenses under 80%', () => {
			expect(progressStatus(50, false)).toBe('ok');
			expect(progressStatus(79, false)).toBe('ok');
		});

		it('returns warning for expenses 80-100%', () => {
			expect(progressStatus(80.1, false)).toBe('warning');
			expect(progressStatus(99, false)).toBe('warning');
		});

		it('returns over for expenses above 100%', () => {
			expect(progressStatus(101, false)).toBe('over');
			expect(progressStatus(150, false)).toBe('over');
		});

		it('returns ok for income at 100%', () => {
			expect(progressStatus(100, true)).toBe('ok');
		});

		it('returns warning for income below 100%', () => {
			expect(progressStatus(50, true)).toBe('warning');
		});
	});

	describe('dailyBudgetRemaining', () => {
		it('calculates daily budget correctly', () => {
			expect(dailyBudgetRemaining(3000, 1000, 20)).toBe(100);
		});

		it('handles 0 days left', () => {
			expect(dailyBudgetRemaining(3000, 1000, 0)).toBe(2000);
		});

		it('handles negative remaining', () => {
			expect(dailyBudgetRemaining(1000, 1500, 10)).toBe(-50);
		});
	});

	describe('monthOverMonthChange', () => {
		it('calculates positive change', () => {
			expect(monthOverMonthChange(1200, 1000)).toBe(20);
		});

		it('calculates negative change', () => {
			expect(monthOverMonthChange(800, 1000)).toBe(-20);
		});

		it('returns 0 when previous is 0', () => {
			expect(monthOverMonthChange(1000, 0)).toBe(0);
		});

		it('handles no change', () => {
			expect(monthOverMonthChange(1000, 1000)).toBe(0);
		});
	});
});

describe('Categorization gauge', () => {
	function categorizationPercent(total: number, categorized: number): number {
		if (total === 0) return 100;
		return Math.round((categorized / total) * 100);
	}

	it('returns 100% when no transactions', () => {
		expect(categorizationPercent(0, 0)).toBe(100);
	});

	it('returns 0% when none categorized', () => {
		expect(categorizationPercent(100, 0)).toBe(0);
	});

	it('returns correct percentage', () => {
		expect(categorizationPercent(200, 150)).toBe(75);
	});

	it('returns 100% when all categorized', () => {
		expect(categorizationPercent(50, 50)).toBe(100);
	});
});
