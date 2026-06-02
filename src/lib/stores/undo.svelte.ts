import { toastStore } from './toast.svelte';

export interface UndoAction {
	label: string;
	undo: () => Promise<void>;
}

export class UndoStore {
	stack = $state<UndoAction[]>([]);
	maxSize = 20;

	push(action: UndoAction) {
		this.stack = [action, ...this.stack.slice(0, this.maxSize - 1)];
	}

	get canUndo(): boolean {
		return this.stack.length > 0;
	}

	get lastAction(): UndoAction | null {
		return this.stack[0] ?? null;
	}

	async undo() {
		const action = this.stack[0];
		if (!action) return;
		this.stack = this.stack.slice(1);
		try {
			await action.undo();
			toastStore.success(`Annulé : ${action.label}`);
		} catch (e) {
			toastStore.error(`Erreur d'annulation : ${e}`);
		}
	}

	clear() {
		this.stack = [];
	}
}

export const undoStore = new UndoStore();
