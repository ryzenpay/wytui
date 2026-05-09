type ToastType = 'success' | 'error' | 'info';

type Toast = {
	id: string;
	type: ToastType;
	message: string;
};

let toasts = $state<Toast[]>([]);

let idCounter = 0;

export function addToast(type: ToastType, message: string, duration = 4000): void {
	const id = `toast-${++idCounter}`;
	toasts = [...toasts, { id, type, message }];

	if (toasts.length > 5) {
		toasts = toasts.slice(-5);
	}

	setTimeout(() => {
		removeToast(id);
	}, duration);
}

export function removeToast(id: string): void {
	toasts = toasts.filter((t) => t.id !== id);
}

export function getToasts() {
	return {
		get list() {
			return toasts;
		},
	};
}
