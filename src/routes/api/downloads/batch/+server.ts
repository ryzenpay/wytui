import { json, error } from '@sveltejs/kit';
import { downloadService } from '$lib/server/services/download.service';
import { prisma } from '$lib/server/db';
import type { RequestHandler } from './$types';

/**
 * POST /api/downloads/batch
 * Create multiple downloads from an array of URLs
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { urls, profileId, saveToLibrary, customFlags } = await request.json();

		if (!urls || !Array.isArray(urls) || urls.length === 0) {
			throw error(400, 'Missing required field: urls (must be a non-empty array)');
		}

		if (!profileId) {
			throw error(400, 'Missing required field: profileId');
		}

		if (urls.length > 100) {
			throw error(400, 'Maximum 100 URLs allowed per batch');
		}

		// Validate all URLs first
		for (const url of urls) {
			if (!url || typeof url !== 'string') {
				throw error(400, 'All URLs must be valid strings');
			}

			try {
				const urlObj = new URL(url);
				if (!['http:', 'https:'].includes(urlObj.protocol)) {
					throw error(400, `Invalid URL protocol: ${url}`);
				}
			} catch {
				throw error(400, `Invalid URL format: ${url}`);
			}
		}

		const flags: string[] = Array.isArray(customFlags) ? customFlags : [];
		const userId = locals.session?.user?.id;

		// Verify profile exists and user has access
		const profile = await prisma.downloadProfile.findUnique({
			where: { id: profileId },
		});
		if (!profile) {
			throw error(400, 'Invalid profile ID');
		}
		if (!profile.isSystem && profile.userId !== userId) {
			throw error(403, 'Cannot use another user\'s profile');
		}

		// Create all downloads
		const results = [];
		const errors = [];

		for (const url of urls) {
			try {
				const download = await downloadService.createDownload(
					url,
					profileId,
					userId,
					undefined,
					!!saveToLibrary,
					flags
				);
				results.push({ url, success: true, download });
			} catch (e: any) {
				errors.push({ url, success: false, error: e.message });
			}
		}

		return json({
			total: urls.length,
			succeeded: results.length,
			failed: errors.length,
			results,
			errors,
		}, { status: 201 });
	} catch (e: any) {
		console.error('Failed to create batch download:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to create batch download');
	}
};
