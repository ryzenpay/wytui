/**
 * Extract the canonical video ID from a YouTube URL.
 *
 * Returns the `v` query param for youtube.com URLs and the path segment for
 * youtu.be short links. Returns null for non-YouTube URLs or unparseable input.
 * Pure URL parsing — safe to use on both client and server.
 */
export function extractVideoId(url: string): string | null {
	try {
		const urlObj = new URL(url);
		if (urlObj.hostname.includes('youtube.com')) {
			return urlObj.searchParams.get('v');
		} else if (urlObj.hostname.includes('youtu.be')) {
			return urlObj.pathname.slice(1) || null;
		}
		return null;
	} catch {
		return null;
	}
}
