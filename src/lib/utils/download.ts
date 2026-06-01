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
	const isMobile = isMobileDevice();
	const hasCanShare = typeof navigator.canShare === 'function';
	const canShare = isMobile && hasCanShare && navigator.canShare({ files: [new File([], 'test')] });

	console.log('[downloadOrShare]', {
		fileId,
		filename,
		isMobile,
		hasCanShare,
		canShare,
		userAgent: navigator.userAgent
	});

	if (!canShare) {
		console.log('[downloadOrShare] Using window.open fallback');
		window.open(fileUrl, '_blank');
		return;
	}

	// Mobile with Share API → fetch blob and share
	try {
		console.log('[downloadOrShare] Fetching blob from', fileUrl);
		const response = await fetch(fileUrl);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const blob = await response.blob();
		const file = new File([blob], filename || 'download', { type: blob.type });

		console.log('[downloadOrShare] Calling navigator.share with file:', {
			name: file.name,
			type: file.type,
			size: file.size
		});

		await navigator.share({ files: [file] });
		console.log('[downloadOrShare] Share succeeded');
		// Success: user shared or saved (no toast needed, native UI provides feedback)
	} catch (error: any) {
		console.error('[downloadOrShare] Share failed:', error);

		// User cancelled the share sheet → AbortError (don't show error)
		if (error.name === 'AbortError') {
			console.log('[downloadOrShare] User cancelled share sheet');
			return;
		}

		// Actual error → show toast with details
		const message = error.message || 'Unknown error';
		addToast('error', `Failed to share file: ${message}`);

		// Fallback: try traditional download
		console.log('[downloadOrShare] Falling back to window.open');
		window.open(fileUrl, '_blank');
	}
}
