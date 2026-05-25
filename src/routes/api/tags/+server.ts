import { error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { apiRoute } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

export const GET = apiRoute('/api/tags', 'GET', {
	summary: 'Get unique tags for autocomplete',
	tags: ['Downloads'],
	auth: true,
	responses: { 200: { description: 'Array of unique tag strings' } },
}, async ({ locals }) => {
	if (!locals.session?.user?.id) throw error(401, 'Authentication required');

	const results = await prisma.$queryRaw<{ tag: string }[]>`
		SELECT DISTINCT unnest(tags) as tag
		FROM downloads
		WHERE "userId" = ${locals.session.user.id}
		AND array_length(tags, 1) > 0
		ORDER BY tag
	`;

	return new Response(JSON.stringify(results.map((r) => r.tag)), {
		headers: { 'Content-Type': 'application/json' },
	});
}) satisfies RequestHandler;
