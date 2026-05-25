import { json, error } from '@sveltejs/kit';
import { backupService } from '$lib/server/services/backup.service';
import { apiRoute } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

export const DELETE = apiRoute('/api/backup/[id]', 'DELETE', {
	summary: 'Delete a backup',
	tags: ['System'],
	auth: 'admin',
	params: { id: { type: 'string', description: 'Backup ID' } },
	responses: {
		200: {
			description: 'Backup deleted',
			schema: {
				type: 'object',
				properties: {
					success: { type: 'boolean' },
				},
			},
		},
		404: { description: 'Backup not found' },
	},
}, async ({ params, locals }) => {
	try {
		if (!locals.session?.user?.isAdmin) throw error(403, 'Admin access required');

		await backupService.deleteBackup(params.id);
		return json({ success: true });
	} catch (e: any) {
		console.error('Failed to delete backup:', e);
		if (e.status) throw e;
		if (e.message === 'Backup not found') throw error(404, 'Backup not found');
		throw error(500, e.message || 'Failed to delete backup');
	}
}) satisfies RequestHandler;
