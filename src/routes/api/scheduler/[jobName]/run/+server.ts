import { json, error } from '@sveltejs/kit';
import { jobScheduler } from '$lib/server/jobs/scheduler';
import { apiRoute } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

export const POST = apiRoute('/api/scheduler/[jobName]/run', 'POST', {
	summary: 'Manually trigger a scheduled job',
	tags: ['System'],
	auth: 'admin',
	params: {
		jobName: { type: 'string', description: 'Job name to trigger' },
	},
	responses: {
		200: {
			description: 'Job triggered successfully',
			schema: {
				type: 'object',
				properties: {
					success: { type: 'boolean' },
				},
			},
		},
		400: { description: 'Unknown job name' },
	},
}, async ({ params, locals }) => {
	try {
		if (!locals.session?.user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		await jobScheduler.runJob(params.jobName);
		return json({ success: true });
	} catch (e: any) {
		console.error(`Failed to run job ${params.jobName}:`, e);
		if (e.status) throw e;
		if (e.message?.startsWith('Unknown job:')) {
			throw error(400, e.message);
		}
		throw error(500, e.message || 'Failed to run job');
	}
}) satisfies RequestHandler;
