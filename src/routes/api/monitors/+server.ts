import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { monitorService } from '$lib/server/services/monitor.service';
import { ytdlpService } from '$lib/server/services/ytdlp.service';
import type { RequestHandler } from './$types';

/**
 * GET /api/monitors
 * List monitors
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const monitors = await prisma.monitor.findMany({
			where: {},
			include: { profile: true },
			orderBy: { createdAt: 'desc' },
		});

		return json(monitors);
	} catch (e: any) {
		console.error('Failed to list monitors:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to list monitors');
	}
};

/**
 * POST /api/monitors
 * Create monitor
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Require authentication
		if (!locals.session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const userId = locals.session.user.id;
		const data = await request.json();

		if (!data.url || !data.name || !data.profileId || !data.type) {
			throw error(400, 'Missing required fields: url, name, profileId, type');
		}

		try {
			const urlObj = new URL(data.url);
			if (!['http:', 'https:'].includes(urlObj.protocol)) {
				throw error(400, 'Invalid URL: only HTTP(S) protocols allowed');
			}
		} catch (e: any) {
			if (e.status) throw e;
			throw error(400, 'Invalid URL format');
		}

		const validTypes = ['YOUTUBE_LIVE', 'TWITCH'];
		if (!validTypes.includes(data.type)) {
			throw error(400, 'Invalid monitor type');
		}

		// Validate custom flags
		const customFlags = Array.isArray(data.customFlags) ? data.customFlags : [];
		if (customFlags.length > 0) {
			const badFlag = ytdlpService.findDangerousFlag(customFlags);
			if (badFlag) {
				throw error(400, `Forbidden flag: ${badFlag}`);
			}
		}

		const monitor = await prisma.monitor.create({
			data: {
				url: data.url,
				name: data.name,
				profileId: data.profileId,
				type: data.type,
				autoDownload: data.autoDownload ?? true,
				customFlags,
			},
			include: { profile: true },
		});

		// Start monitoring
		await monitorService.startMonitor(monitor);

		return json(monitor, { status: 201 });
	} catch (e: any) {
		console.error('Failed to create monitor:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to create monitor');
	}
};
