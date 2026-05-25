import { goto } from '$app/navigation';

let showHelp = $state(false);

let pendingG = $state(false);
let gTimer: ReturnType<typeof setTimeout> | null = null;

export function getKeyboardState() {
	return {
		get showHelp() {
			return showHelp;
		},
		set showHelp(v: boolean) {
			showHelp = v;
		},
		toggleHelp() {
			showHelp = !showHelp;
		},
		closeHelp() {
			showHelp = false;
		},
	};
}

function isInputFocused(): boolean {
	const el = document.activeElement;
	if (!el) return false;
	const tag = el.tagName.toLowerCase();
	if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
	if ((el as HTMLElement).isContentEditable) return true;
	return false;
}

function handleKeydown(e: KeyboardEvent) {
	// Ctrl+K / Cmd+K — always works, even in inputs
	if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
		e.preventDefault();
		goto('/search');
		return;
	}

	// Skip remaining shortcuts when focused on an input element
	if (isInputFocused()) return;

	// G-sequence shortcuts
	if (pendingG) {
		pendingG = false;
		if (gTimer) {
			clearTimeout(gTimer);
			gTimer = null;
		}

		switch (e.key.toLowerCase()) {
			case 'd':
				e.preventDefault();
				goto('/downloads');
				return;
			case 's':
				e.preventDefault();
				goto('/subscriptions');
				return;
			case 'm':
				e.preventDefault();
				goto('/monitors');
				return;
			case 'p':
				e.preventDefault();
				goto('/playlists');
				return;
		}
	}

	// ? — toggle keyboard help
	if (e.key === '?') {
		e.preventDefault();
		showHelp = !showHelp;
		return;
	}

	// N — go to downloads (new download form)
	if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
		e.preventDefault();
		goto('/downloads');
		return;
	}

	// G — start G-sequence
	if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
		pendingG = true;
		gTimer = setTimeout(() => {
			pendingG = false;
			gTimer = null;
		}, 1000);
		return;
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('keydown', handleKeydown);
}
