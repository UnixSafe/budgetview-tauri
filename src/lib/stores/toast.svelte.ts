export interface Toast {
	id: number;
	message: string;
	type: 'success' | 'error' | 'info';
	duration: number;
	createdAt: number;
}

let nextId = 0;

export class ToastStore {
	toasts = $state<Toast[]>([]);

	show(message: string, type: Toast['type'] = 'info', duration = 3000) {
		const id = nextId++;
		this.toasts.push({ id, message, type, duration, createdAt: Date.now() });
		if (this.toasts.length > 4) {
			this.toasts = this.toasts.slice(-4);
		}
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
