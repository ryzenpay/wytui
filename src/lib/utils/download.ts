import { addToast } from '$lib/stores/toast.svelte';

function isMobileDevice(): boolean {
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
		navigator.userAgent
	);
}

/**
 * Download or share a file, using the Web Share API on mobile devices when available.
 * Falls back to traditional window.open() download on desktop or when sharing fails.
 */
export async function downloadOrShare(fileId: string, filename?: string): Promise<void> {
	const fileUrl = `/api/files/${fileId}`;

	// Desktop or no Share API support → traditional download
	const canShare = isMobileDevice() && navigator.canShare?.({ files: [new File([], 'test')] });
	if (!canShare) {
		window.open(fileUrl, '_blank');
		return;
	}

	// Mobile with Share API → fetch blob and share
	try {
		const response = await fetch(fileUrl);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const blob = await response.blob();
		const file = new File([blob], filename || 'download', { type: blob.type });

		await navigator.share({ files: [file] });
		// Success: user shared or saved (no toast needed, native UI provides feedback)
	} catch (error: any) {
		// User cancelled the share sheet → AbortError (don't show error)
		if (error.name === 'AbortError') return;

		// Actual error → show toast with details
		console.error('Share failed:', error);
		const message = error.message || 'Unknown error';
		addToast('error', `Failed to share file: ${message}`);

		// Fallback: try traditional download
		window.open(fileUrl, '_blank');
	}
}
