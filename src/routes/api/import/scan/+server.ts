import { json, error } from '@sveltejs/kit';
import { importService } from '$lib/server/services/import.service';
import { apiRoute } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

export const POST = apiRoute('/api/import/scan', 'POST', {
	summary: 'Scan directory for importable files',
	tags: ['Library'],
	auth: 'admin',
	body: {
		path: { type: 'string', required: true, description: 'Directory path to scan' },
	},
	responses: {
		200: {
			description: 'List of discovered files',
			schema: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						filepath: { type: 'string' },
						filename: { type: 'string' },
						sizeBytes: { type: 'string' },
						videoId: { type: 'string', nullable: true },
					},
				},
			},
		},
	},
}, async ({ request, locals }) => {
	try {
		if (!locals.session?.user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const { path } = await request.json();

		if (!path || typeof path !== 'string') {
			throw error(400, 'Missing required field: path');
		}

		const files = await importService.scanDirectory(path);
		return json(files);
	} catch (e: any) {
		console.error('Failed to scan directory:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to scan directory');
	}
}) satisfies RequestHandler;
