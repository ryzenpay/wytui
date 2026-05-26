import { json, error } from '@sveltejs/kit';
import { downloadService } from '$lib/server/services/download.service';
import { prisma } from '$lib/server/db';
import { apiRoute } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: corsHeaders });
};

export const POST = apiRoute('/api/downloads/quick', 'POST', {
	summary: 'Quick download (browser extension)',
	description: 'Simplified endpoint for browser extensions. Accepts just a URL and uses the default profile.',
	tags: ['Downloads'],
	auth: true,
	body: {
		url: { type: 'string', required: true, description: 'URL to download' },
	},
	responses: {
		201: {
			description: 'Created download object',
			schema: {
				type: 'object',
				properties: {
					id: { type: 'string' },
					url: { type: 'string' },
					status: { type: 'string', enum: ['PENDING', 'FETCHING_INFO', 'DOWNLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] },
					title: { type: 'string', nullable: true },
					thumbnail: { type: 'string', nullable: true },
					duration: { type: 'integer', nullable: true },
					uploader: { type: 'string', nullable: true },
					progress: { type: 'number' },
					speed: { type: 'string', nullable: true },
					eta: { type: 'string', nullable: true },
					filename: { type: 'string', nullable: true },
					filepath: { type: 'string', nullable: true },
					filesize: { type: 'string', nullable: true },
					profileId: { type: 'string' },
					userId: { type: 'string', nullable: true },
					storagePool: { type: 'string', enum: ['cache', 'library'] },
					createdAt: { type: 'string', format: 'date-time' },
					completedAt: { type: 'string', format: 'date-time', nullable: true },
				},
			},
		},
	},
}, async ({ request, locals }) => {
	try {
		const { url } = await request.json();

		if (!url) {
			return json({ error: 'Missing required field: url' }, { status: 400, headers: corsHeaders });
		}

		// Validate URL format
		try {
			const urlObj = new URL(url);
			if (!['http:', 'https:'].includes(urlObj.protocol)) {
				return json({ error: 'Only HTTP(S) URLs are allowed' }, { status: 400, headers: corsHeaders });
			}
		} catch {
			return json({ error: 'Invalid URL format' }, { status: 400, headers: corsHeaders });
		}

		const userId = locals.session?.user?.id;

		// Find user's first profile, falling back to system profile
		const profile = await prisma.downloadProfile.findFirst({
			where: {
				OR: [
					{ userId: locals.session.user.id },
					{ isSystem: true },
				],
			},
			orderBy: { isSystem: 'asc' },
		});

		if (!profile) {
			return json({ error: 'No download profile found. Create a profile first.' }, { status: 400, headers: corsHeaders });
		}

		const download = await downloadService.createDownload(url, profile.id, userId);

		return json(download, { status: 201, headers: corsHeaders });
	} catch (e: any) {
		console.error('Failed to create quick download:', e);
		return json(
			{ error: e.message || 'Failed to create download' },
			{ status: e.status || 500, headers: corsHeaders }
		);
	}
}) satisfies RequestHandler;
