import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastStore } from './toast.svelte';

describe('ToastStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
	});

	it('adds info toasts by default and dismisses them after the duration', () => {
		const store = new ToastStore();

		store.show('Message');

		expect(store.toasts).toEqual([
			expect.objectContaining({ id: expect.any(Number), message: 'Message', type: 'info', duration: 3000 })
		]);

		vi.advanceTimersByTime(3000);

		expect(store.toasts).toEqual([]);
	});

	it('uses typed helpers and keeps only the last four toasts', () => {
		const store = new ToastStore();

		store.success('Un');
		store.error('Deux');
		store.show('Trois');
		store.show('Quatre');
		store.show('Cinq');

		expect(store.toasts.map((toast) => toast.message)).toEqual(['Deux', 'Trois', 'Quatre', 'Cinq']);
		expect(store.toasts[0].type).toBe('error');
		expect(store.toasts[0].duration).toBe(5000);
	});

	it('dismisses a specific toast', () => {
		const store = new ToastStore();
		store.show('A');
		store.show('B');

		const [first] = store.toasts;
		store.dismiss(first.id);

		expect(store.toasts.map((toast) => toast.message)).toEqual(['B']);
	});
});
