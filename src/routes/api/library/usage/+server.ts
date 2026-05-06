import { json, error } from '@sveltejs/kit';
import { libraryService } from '$lib/server/services/library.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const usage = await libraryService.getCacheUsage();
		return json(usage);
	} catch (e: any) {
		console.error('Failed to get cache usage:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to get cache usage');
	}
};
