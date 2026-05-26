import { json, error } from '@sveltejs/kit';
import { downloadService } from '$lib/server/services/download.service';
import { ytdlpService } from '$lib/server/services/ytdlp.service';
import { prisma } from '$lib/server/db';
import { apiRoute } from '$lib/server/openapi';
import { sseEmitter } from '$lib/server/sse/emitter';
import { spawn } from 'child_process';
import type { RequestHandler } from './$types';

interface PlaylistEntry {
	id: string;
	url: string;
	title: string | null;
	duration: number | null;
	uploader: string | null;
}

/**
 * Extract playlist entries using yt-dlp --flat-playlist -J
 */
function extractPlaylistInfo(url: string): Promise<{ title: string; entries: PlaylistEntry[] }> {
	return new Promise((resolve, reject) => {
		const proc = spawn(ytdlpService.getPath(), [
			'--flat-playlist',
			'-J',
			'--no-warnings',
			url,
		]);

		let output = '';
		let errorOutput = '';

		proc.stdout.on('data', (data) => {
			output += data.toString();
		});

		proc.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		proc.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`yt-dlp failed: ${errorOutput || 'unknown error'}`));
				return;
			}

			try {
				const info = JSON.parse(output);

				if (!info.entries || !Array.isArray(info.entries)) {
					reject(new Error('URL does not appear to be a playlist'));
					return;
				}

				const entries: PlaylistEntry[] = info.entries.map((entry: any) => {
					let videoUrl = entry.url;
					// yt-dlp flat-playlist may return just the video ID
					if (videoUrl && !videoUrl.startsWith('http')) {
						videoUrl = `https://www.youtube.com/watch?v=${entry.id || entry.url}`;
					}

					return {
						id: entry.id || '',
						url: videoUrl || `https://www.youtube.com/watch?v=${entry.id}`,
						title: entry.title || null,
						duration: entry.duration || null,
						uploader: entry.uploader || entry.channel || null,
					};
				});

				resolve({
					title: info.title || 'Unknown Playlist',
					entries,
				});
			} catch (e) {
				reject(new Error(`Failed to parse playlist data: ${e}`));
			}
		});
	});
}

export const POST = apiRoute('/api/playlists/import', 'POST', {
	summary: 'Import a YouTube playlist as individual downloads',
	tags: ['Downloads'],
	auth: true,
	body: {
		url: { type: 'string', required: true, description: 'YouTube playlist URL' },
		profileId: { type: 'string', required: true, description: 'Download profile ID' },
		saveToLibrary: { type: 'boolean', description: 'Save to library instead of cache' },
		customFlags: { type: 'array', description: 'Custom yt-dlp flags' },
	},
	responses: {
		200: {
			description: 'Playlist import result',
			schema: {
				type: 'object',
				properties: {
					playlistTitle: { type: 'string' },
					totalVideos: { type: 'integer' },
					createdIds: { type: 'array', items: { type: 'string' } },
					skipped: { type: 'integer' },
					errors: { type: 'array', items: { type: 'string' } },
				},
			},
		},
	},
}, async ({ request, locals }) => {
	try {
		const userId = locals.session?.user?.id;
		if (!userId) {
			throw error(401, 'Authentication required');
		}

		const { url, profileId, saveToLibrary, customFlags } = await request.json();

		if (!url || !profileId) {
			throw error(400, 'Missing required fields: url, profileId');
		}

		// Validate URL
		ytdlpService.validateUrl(url);

		// Verify profile exists and user has access
		const profile = await prisma.downloadProfile.findUnique({
			where: { id: profileId },
		});
		if (!profile) {
			throw error(400, 'Invalid profile ID');
		}
		if (!profile.isSystem && profile.userId !== userId) {
			throw error(403, "Cannot use another user's profile");
		}

		const flags: string[] = Array.isArray(customFlags) ? customFlags : [];

		// Send initial SSE event
		sseEmitter.broadcastToUser('playlist:import:start', { url }, userId);

		// Extract playlist info
		let playlistInfo;
		try {
			playlistInfo = await extractPlaylistInfo(url);
		} catch (e: any) {
			throw error(400, e.message || 'Failed to extract playlist information');
		}

		const { title: playlistTitle, entries } = playlistInfo;

		if (entries.length === 0) {
			throw error(400, 'Playlist contains no videos');
		}

		// Send progress with total count
		sseEmitter.broadcastToUser('playlist:import:progress', {
			playlistTitle,
			total: entries.length,
			created: 0,
			skipped: 0,
		}, userId);

		const createdIds: string[] = [];
		const errors: string[] = [];
		let skipped = 0;

		// Create downloads for each entry
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];

			try {
				const download = await downloadService.createDownload(
					entry.url,
					profileId,
					userId,
					undefined,
					!!saveToLibrary,
					flags
				);
				createdIds.push(download.id);
			} catch (e: any) {
				if (e.message?.includes('already being downloaded')) {
					skipped++;
				} else {
					errors.push(`${entry.title || entry.url}: ${e.message}`);
				}
			}

			// Send progress update every 5 items or on the last item
			if ((i + 1) % 5 === 0 || i === entries.length - 1) {
				sseEmitter.broadcastToUser('playlist:import:progress', {
					playlistTitle,
					total: entries.length,
					created: createdIds.length,
					skipped,
					errors: errors.length,
					current: i + 1,
				}, userId);
			}
		}

		// Send completion event
		sseEmitter.broadcastToUser('playlist:import:complete', {
			playlistTitle,
			totalVideos: entries.length,
			created: createdIds.length,
			skipped,
			errors: errors.length,
		}, userId);

		return json({
			playlistTitle,
			totalVideos: entries.length,
			createdIds,
			skipped,
			errors,
		});
	} catch (e: any) {
		console.error('Failed to import playlist:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to import playlist');
	}
}) satisfies RequestHandler;
