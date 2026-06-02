import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/stores/toast.svelte', () => ({
	toastStore: {
		success: vi.fn(),
		error: vi.fn(),
	}
}));

import { toastStore } from '$lib/stores/toast.svelte';
import { UndoStore } from './undo.svelte';

describe('UndoStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('pushes actions in LIFO order and enforces max stack size', () => {
		const store = new UndoStore();

		for (let i = 0; i < 30; i++) {
			store.push({ label: `action${i}`, undo: vi.fn() });
		}

		expect(store.stack).toHaveLength(20);
		expect(store.lastAction?.label).toBe('action29');
		expect(store.canUndo).toBe(true);
	});

	it('runs undo, removes the action and notifies success', async () => {
		const store = new UndoStore();
		const undoFn = vi.fn();
		store.push({ label: 'test', undo: undoFn });

		await store.undo();

		expect(undoFn).toHaveBeenCalled();
		expect(store.canUndo).toBe(false);
		expect(toastStore.success).toHaveBeenCalledWith('Annulé : test');
	});

	it('keeps going when undo is called on an empty stack or fails', async () => {
		const store = new UndoStore();

		await store.undo();
		expect(toastStore.success).not.toHaveBeenCalled();

		store.push({ label: 'bad', undo: vi.fn().mockRejectedValue(new Error('boom')) });
		await store.undo();

		expect(toastStore.error).toHaveBeenCalledWith('Erreur d\'annulation : Error: boom');
	});

	it('clears the stack', () => {
		const store = new UndoStore();
		store.push({ label: 'test', undo: vi.fn() });

		store.clear();

		expect(store.stack).toEqual([]);
		expect(store.lastAction).toBeNull();
	});
});
