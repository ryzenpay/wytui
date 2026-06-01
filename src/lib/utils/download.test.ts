import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadOrShare } from './download';
import * as toastStore from '$lib/stores/toast.svelte';

// Mock the toast store
vi.mock('$lib/stores/toast.svelte', () => ({
	addToast: vi.fn(),
}));

describe('downloadOrShare', () => {
	let originalUserAgent: string;
	let originalNavigator: typeof navigator;
	let windowOpenSpy: ReturnType<typeof vi.fn>;
	let fetchSpy: ReturnType<typeof vi.fn>;
	let navigatorShareSpy: ReturnType<typeof vi.fn>;
	let navigatorCanShareSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Save original values
		originalUserAgent = navigator.userAgent;
		originalNavigator = global.navigator;

		// Reset mocks
		vi.clearAllMocks();

		// Mock window.open
		windowOpenSpy = vi.fn();
		(global.window.open as any) = windowOpenSpy;

		// Mock fetch
		fetchSpy = vi.fn();
		(global.fetch as any) = fetchSpy;

		// Mock navigator.share and navigator.canShare
		navigatorShareSpy = vi.fn();
		navigatorCanShareSpy = vi.fn();
	});

	afterEach(() => {
		// Restore original navigator
		Object.defineProperty(global, 'navigator', {
			value: originalNavigator,
			writable: true,
			configurable: true,
		});
	});

	function mockMobileDevice() {
		Object.defineProperty(global.navigator, 'userAgent', {
			value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
			writable: true,
			configurable: true,
		});
	}

	function mockDesktopDevice() {
		Object.defineProperty(global.navigator, 'userAgent', {
			value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
			writable: true,
			configurable: true,
		});
	}

	function mockShareAPI(canShare = true) {
		Object.defineProperty(global.navigator, 'canShare', {
			value: navigatorCanShareSpy.mockReturnValue(canShare),
			writable: true,
			configurable: true,
		});
		Object.defineProperty(global.navigator, 'share', {
			value: navigatorShareSpy,
			writable: true,
			configurable: true,
		});
	}

	describe('Desktop behavior', () => {
		it('should use window.open on desktop browsers', async () => {
			mockDesktopDevice();

			await downloadOrShare('test-file-id', 'test.mp4');

			expect(windowOpenSpy).toHaveBeenCalledWith('/api/files/test-file-id', '_blank');
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(navigatorShareSpy).not.toHaveBeenCalled();
		});

		it('should use window.open when Share API is not available', async () => {
			mockMobileDevice();
			// Don't mock Share API (it's undefined)

			await downloadOrShare('test-file-id');

			expect(windowOpenSpy).toHaveBeenCalledWith('/api/files/test-file-id', '_blank');
			expect(fetchSpy).not.toHaveBeenCalled();
		});
	});

	describe('Mobile behavior with Share API', () => {
		beforeEach(() => {
			mockMobileDevice();
			mockShareAPI(true);
		});

		it('should use Share API on mobile when available', async () => {
			const mockBlob = new Blob(['test content'], { type: 'video/mp4' });
			fetchSpy.mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});
			navigatorShareSpy.mockResolvedValue(undefined);

			await downloadOrShare('test-file-id', 'test-video.mp4');

			expect(navigatorCanShareSpy).toHaveBeenCalledWith({ files: [expect.any(File)] });
			expect(fetchSpy).toHaveBeenCalledWith('/api/files/test-file-id');
			expect(navigatorShareSpy).toHaveBeenCalledWith({
				files: [expect.any(File)],
			});
			expect(windowOpenSpy).not.toHaveBeenCalled();
		});

		it('should use provided filename in Share API', async () => {
			const mockBlob = new Blob(['test content'], { type: 'video/mp4' });
			fetchSpy.mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});
			navigatorShareSpy.mockResolvedValue(undefined);

			await downloadOrShare('test-file-id', 'my-custom-video.mp4');

			const shareCall = navigatorShareSpy.mock.calls[0][0];
			const file = shareCall.files[0];
			expect(file.name).toBe('my-custom-video.mp4');
			expect(file.type).toBe('video/mp4');
		});

		it('should use "download" as default filename when none provided', async () => {
			const mockBlob = new Blob(['test content'], { type: 'video/mp4' });
			fetchSpy.mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});
			navigatorShareSpy.mockResolvedValue(undefined);

			await downloadOrShare('test-file-id');

			const shareCall = navigatorShareSpy.mock.calls[0][0];
			const file = shareCall.files[0];
			expect(file.name).toBe('download');
		});

		it('should silently handle AbortError (user cancelled)', async () => {
			const mockBlob = new Blob(['test content'], { type: 'video/mp4' });
			fetchSpy.mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});

			const abortError = new Error('User cancelled');
			abortError.name = 'AbortError';
			navigatorShareSpy.mockRejectedValue(abortError);

			await downloadOrShare('test-file-id', 'test.mp4');

			// Should not show toast for AbortError
			expect(toastStore.addToast).not.toHaveBeenCalled();
			// Should not fallback to window.open
			expect(windowOpenSpy).not.toHaveBeenCalled();
		});

		it('should show toast and fallback on network error', async () => {
			fetchSpy.mockRejectedValue(new Error('Network error'));

			await downloadOrShare('test-file-id', 'test.mp4');

			expect(toastStore.addToast).toHaveBeenCalledWith(
				'error',
				'Failed to share file: Network error'
			);
			expect(windowOpenSpy).toHaveBeenCalledWith('/api/files/test-file-id', '_blank');
		});

		it('should show toast and fallback on HTTP error', async () => {
			fetchSpy.mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			await downloadOrShare('test-file-id', 'test.mp4');

			expect(toastStore.addToast).toHaveBeenCalledWith(
				'error',
				'Failed to share file: HTTP 404: Not Found'
			);
			expect(windowOpenSpy).toHaveBeenCalledWith('/api/files/test-file-id', '_blank');
		});

		it('should show toast and fallback on share error', async () => {
			const mockBlob = new Blob(['test content'], { type: 'video/mp4' });
			fetchSpy.mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});

			const shareError = new Error('Share failed');
			shareError.name = 'NotAllowedError';
			navigatorShareSpy.mockRejectedValue(shareError);

			await downloadOrShare('test-file-id', 'test.mp4');

			expect(toastStore.addToast).toHaveBeenCalledWith(
				'error',
				'Failed to share file: Share failed'
			);
			expect(windowOpenSpy).toHaveBeenCalledWith('/api/files/test-file-id', '_blank');
		});

		it('should handle error without message', async () => {
			const mockBlob = new Blob(['test content'], { type: 'video/mp4' });
			fetchSpy.mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});

			navigatorShareSpy.mockRejectedValue({});

			await downloadOrShare('test-file-id', 'test.mp4');

			expect(toastStore.addToast).toHaveBeenCalledWith(
				'error',
				'Failed to share file: Unknown error'
			);
			expect(windowOpenSpy).toHaveBeenCalledWith('/api/files/test-file-id', '_blank');
		});
	});

	describe('Mobile detection', () => {
		it('should detect Android devices', async () => {
			Object.defineProperty(global.navigator, 'userAgent', {
				value: 'Mozilla/5.0 (Linux; Android 11)',
				writable: true,
				configurable: true,
			});
			mockShareAPI(true);
			const mockBlob = new Blob(['test'], { type: 'video/mp4' });
			fetchSpy.mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockBlob) });
			navigatorShareSpy.mockResolvedValue(undefined);

			await downloadOrShare('test-file-id');

			expect(navigatorShareSpy).toHaveBeenCalled();
		});

		it('should detect iOS devices (iPhone)', async () => {
			Object.defineProperty(global.navigator, 'userAgent', {
				value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
				writable: true,
				configurable: true,
			});
			mockShareAPI(true);
			const mockBlob = new Blob(['test'], { type: 'video/mp4' });
			fetchSpy.mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockBlob) });
			navigatorShareSpy.mockResolvedValue(undefined);

			await downloadOrShare('test-file-id');

			expect(navigatorShareSpy).toHaveBeenCalled();
		});

		it('should detect iOS devices (iPad)', async () => {
			Object.defineProperty(global.navigator, 'userAgent', {
				value: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)',
				writable: true,
				configurable: true,
			});
			mockShareAPI(true);
			const mockBlob = new Blob(['test'], { type: 'video/mp4' });
			fetchSpy.mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockBlob) });
			navigatorShareSpy.mockResolvedValue(undefined);

			await downloadOrShare('test-file-id');

			expect(navigatorShareSpy).toHaveBeenCalled();
		});
	});

	describe('Edge cases', () => {
		it('should handle canShare returning false', async () => {
			mockMobileDevice();
			mockShareAPI(false); // canShare returns false

			await downloadOrShare('test-file-id', 'test.mp4');

			expect(windowOpenSpy).toHaveBeenCalledWith('/api/files/test-file-id', '_blank');
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(navigatorShareSpy).not.toHaveBeenCalled();
		});

		it('should preserve blob type in File object', async () => {
			mockMobileDevice();
			mockShareAPI(true);

			const mockBlob = new Blob(['test content'], { type: 'audio/mp3' });
			fetchSpy.mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});
			navigatorShareSpy.mockResolvedValue(undefined);

			await downloadOrShare('test-file-id', 'song.mp3');

			const shareCall = navigatorShareSpy.mock.calls[0][0];
			const file = shareCall.files[0];
			expect(file.type).toBe('audio/mp3');
		});
	});
});
