import { json, error } from '@sveltejs/kit';
import { playlistService } from '$lib/server/services/playlist.service';
import { apiRoute } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

export const POST = apiRoute('/api/playlists/[id]/items', 'POST', {
	summary: 'Add item to playlist',
	tags: ['Playlists'],
	auth: true,
	params: { id: { type: 'string', description: 'Playlist ID' } },
	body: {
		downloadId: { type: 'string', required: true, description: 'Download ID to add' },
	},
	responses: {
		201: {
			description: 'Item added',
			schema: {
				type: 'object',
				properties: {
					id: { type: 'string' },
					playlistId: { type: 'string' },
					downloadId: { type: 'string' },
					position: { type: 'integer' },
				},
			},
		},
		404: { description: 'Playlist not found' },
	},
}, async ({ params, request, locals }) => {
	try {
		if (!locals.session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const { downloadId } = await request.json();
		if (!downloadId) {
			throw error(400, 'downloadId is required');
		}

		const item = await playlistService.addItem(params.id, locals.session.user.id, downloadId);
		return json(item, { status: 201 });
	} catch (e: any) {
		if (e.status) throw e;
		if (e.message === 'Playlist not found') throw error(404, e.message);
		if (e.message === 'Access denied') throw error(403, e.message);
		if (e.code === 'P2002') throw error(409, 'Item already in playlist');
		throw error(500, e.message || 'Failed to add item');
	}
}) satisfies RequestHandler;

export const DELETE = apiRoute('/api/playlists/[id]/items', 'DELETE', {
	summary: 'Remove item from playlist',
	tags: ['Playlists'],
	auth: true,
	params: { id: { type: 'string', description: 'Playlist ID' } },
	body: {
		downloadId: { type: 'string', required: true, description: 'Download ID to remove' },
	},
	responses: {
		200: {
			description: 'Item removed',
			schema: {
				type: 'object',
				properties: {
					success: { type: 'boolean' },
				},
			},
		},
		404: { description: 'Playlist or item not found' },
	},
}, async ({ params, request, locals }) => {
	try {
		if (!locals.session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const { downloadId } = await request.json();
		if (!downloadId) {
			throw error(400, 'downloadId is required');
		}

		await playlistService.removeItem(params.id, locals.session.user.id, downloadId);
		return json({ success: true });
	} catch (e: any) {
		if (e.status) throw e;
		if (e.message === 'Playlist not found') throw error(404, e.message);
		if (e.message === 'Access denied') throw error(403, e.message);
		throw error(500, e.message || 'Failed to remove item');
	}
}) satisfies RequestHandler;

export const PATCH = apiRoute('/api/playlists/[id]/items', 'PATCH', {
	summary: 'Reorder playlist items',
	tags: ['Playlists'],
	auth: true,
	params: { id: { type: 'string', description: 'Playlist ID' } },
	body: {
		itemIds: { type: 'array', required: true, description: 'Ordered array of item IDs' },
	},
	responses: {
		200: {
			description: 'Items reordered',
			schema: {
				type: 'object',
				properties: {
					success: { type: 'boolean' },
				},
			},
		},
		404: { description: 'Playlist not found' },
	},
}, async ({ params, request, locals }) => {
	try {
		if (!locals.session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		const { itemIds } = await request.json();
		if (!Array.isArray(itemIds) || itemIds.length === 0) {
			throw error(400, 'itemIds must be a non-empty array');
		}

		await playlistService.reorderItems(params.id, locals.session.user.id, itemIds);
		return json({ success: true });
	} catch (e: any) {
		if (e.status) throw e;
		if (e.message === 'Playlist not found') throw error(404, e.message);
		if (e.message === 'Access denied') throw error(403, e.message);
		throw error(500, e.message || 'Failed to reorder items');
	}
}) satisfies RequestHandler;
