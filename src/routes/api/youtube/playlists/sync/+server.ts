import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/guards';
import { youtubeService, isYouTubeUrl, type YtEntry } from '$lib/server/services/youtube.service';
import { playlistService } from '$lib/server/services/playlist.service';
import type { RequestHandler } from './$types';

// Cap per request to bound the number of (slow) yt-dlp calls we make.
const MAX_PLAYLISTS = 50;

// Sync selected YouTube playlists into wytui as playlists of pending items
// (snapshots only — videos are downloaded later). Each URL is handed to yt-dlp,
// so it must pass the SSRF allowlist.
export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = requireAuth(locals);
	const body = await request.json().catch(() => null);
	const selected = Array.isArray(body?.playlists) ? body.playlists : null;
	if (!selected || selected.length === 0) throw error(400, 'playlists[] required');
	if (selected.length > MAX_PLAYLISTS)
		throw error(400, `Select at most ${MAX_PLAYLISTS} playlists`);

	const resolved: { title: string; entries: YtEntry[] }[] = [];
	for (const pl of selected) {
		if (!pl || !isYouTubeUrl(pl.url)) throw error(400, 'Invalid YouTube playlist URL');
		const result = await youtubeService.fetchPlaylist(userId, pl.url);
		if ('needsRelink' in result) return json({ needsRelink: true });
		resolved.push({
			title: typeof pl.title === 'string' ? pl.title : 'YouTube Playlist',
			entries: result,
		});
	}

	const summary = await playlistService.syncYouTubePlaylists(userId, resolved);
	return json(summary);
};
