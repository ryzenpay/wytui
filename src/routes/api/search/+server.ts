import { error } from '@sveltejs/kit';
import { searchService } from '$lib/server/services/search.service';
import { apiRoute } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

export const GET = apiRoute('/api/search', 'GET', {
	summary: 'Full-text search downloads',
	tags: ['Downloads'],
	auth: true,
	query: {
		q: { type: 'string', description: 'Search query' },
		limit: { type: 'integer', default: 20 },
		offset: { type: 'integer', default: 0 },
		videoType: { type: 'string', description: 'Filter by video type' },
		storagePool: { type: 'string', description: 'Filter by storage pool' },
		uploader: { type: 'string', description: 'Filter by uploader name' },
	},
	responses: { 200: { description: 'Search results' } },
}, async ({ locals, url }) => {
	if (!locals.session?.user?.id) throw error(401, 'Authentication required');

	const q = url.searchParams.get('q');
	if (!q?.trim()) {
		return new Response(JSON.stringify({ results: [], total: 0 }), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const result = await searchService.search(q, locals.session.user.id, {
		limit: parseInt(url.searchParams.get('limit') || '20'),
		offset: parseInt(url.searchParams.get('offset') || '0'),
		videoType: url.searchParams.get('videoType') || undefined,
		storagePool: url.searchParams.get('storagePool') || undefined,
		uploader: url.searchParams.get('uploader') || undefined,
	});

	return new Response(JSON.stringify(result), {
		headers: { 'Content-Type': 'application/json' },
	});
}) satisfies RequestHandler;
