export interface Toast {
	id: number;
	message: string;
	type: 'success' | 'error' | 'info';
}

let nextId = 0;

class ToastStore {
	toasts = $state<Toast[]>([]);

	show(message: string, type: Toast['type'] = 'info', duration = 3000) {
		const id = nextId++;
		this.toasts.push({ id, message, type });
		setTimeout(() => this.dismiss(id), duration);
	}

	success(message: string) {
		this.show(message, 'success');
	}

	error(message: string) {
		this.show(message, 'error', 5000);
	}

	dismiss(id: number) {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}
}

export const toastStore = new ToastStore();
