import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session?.user?.isAdmin) {
		throw error(403, 'Admin access required');
	}

	const { url, apiKey } = await request.json();

	if (!url || !apiKey) {
		return json({ success: false, error: 'URL and API key are required' });
	}

	try {
		const baseUrl = url.replace(/\/$/, '');
		const res = await fetch(`${baseUrl}/System/Info`, {
			headers: { 'X-Emby-Token': apiKey },
			signal: AbortSignal.timeout(10000),
		});

		if (!res.ok) {
			return json({ success: false, error: `Server returned ${res.status}` });
		}

		const info = await res.json();
		return json({ success: true, serverName: info.ServerName || 'Jellyfin' });
	} catch (e: any) {
		const message = e.name === 'TimeoutError' ? 'Connection timed out' : (e.message || 'Connection failed');
		return json({ success: false, error: message });
	}
};
