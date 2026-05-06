import { json, error } from '@sveltejs/kit';
import { libraryService } from '$lib/server/services/library.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const count = await libraryService.clearCache();
		return json({ success: true, deleted: count });
	} catch (e: any) {
		console.error('Failed to clear cache:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to clear cache');
	}
};
