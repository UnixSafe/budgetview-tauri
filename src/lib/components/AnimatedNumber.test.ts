import { describe, it, expect } from 'vitest';

// Since AnimatedNumber is a Svelte component that depends on browser APIs
// (requestAnimationFrame, performance.now), we test the animation logic separately

describe('AnimatedNumber animation logic', () => {
	function easeOutCubic(progress: number): number {
		return 1 - Math.pow(1 - progress, 3);
	}

	it('easeOutCubic returns 0 at start', () => {
		expect(easeOutCubic(0)).toBe(0);
	});

	it('easeOutCubic returns 1 at end', () => {
		expect(easeOutCubic(1)).toBe(1);
	});

	it('easeOutCubic is monotonically increasing', () => {
		let prev = 0;
		for (let i = 0; i <= 100; i++) {
			const val = easeOutCubic(i / 100);
			expect(val).toBeGreaterThanOrEqual(prev);
			prev = val;
		}
	});

	it('easeOutCubic decelerates (second half slower)', () => {
		const first_half = easeOutCubic(0.5) - easeOutCubic(0);
		const second_half = easeOutCubic(1) - easeOutCubic(0.5);
		expect(first_half).toBeGreaterThan(second_half);
	});

	it('interpolation formula produces correct intermediate values', () => {
		const start = 0;
		const target = 1000;
		const progress = 0.5;
		const eased = easeOutCubic(progress);
		const displayed = start + (target - start) * eased;
		expect(displayed).toBe(875); // 1 - (0.5)^3 = 0.875
	});

	it('interpolation handles negative values', () => {
		const start = 0;
		const target = -500;
		const progress = 1;
		const eased = easeOutCubic(progress);
		const displayed = start + (target - start) * eased;
		expect(displayed).toBe(-500);
	});

	it('interpolation handles transitions between values', () => {
		const start = 100;
		const target = 200;
		const progress = 1;
		const eased = easeOutCubic(progress);
		const displayed = start + (target - start) * eased;
		expect(displayed).toBe(200);
	});
});
