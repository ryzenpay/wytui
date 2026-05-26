import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.session?.user?.id) throw error(401, 'Authentication required');

	const search = url.searchParams.get('q')?.trim() || '';

	const groups = await prisma.download.groupBy({
		by: ['uploader'],
		where: {
			userId: locals.session.user.id,
			status: 'COMPLETED',
			uploader: { not: null, ...(search ? { contains: search, mode: 'insensitive' } : {}) },
		},
		_count: { id: true },
		orderBy: { _count: { id: 'desc' } },
	});

	// Fetch a representative thumbnail per uploader
	const uploaderNames = groups.map((g) => g.uploader).filter(Boolean) as string[];
	const thumbnails = await prisma.download.findMany({
		where: {
			userId: locals.session.user.id,
			status: 'COMPLETED',
			uploader: { in: uploaderNames },
			thumbnail: { not: null },
		},
		select: { uploader: true, thumbnail: true },
		distinct: ['uploader'],
	});
	const thumbMap = new Map(thumbnails.map((t) => [t.uploader, t.thumbnail]));

	return json(
		groups.map((g) => ({
			name: g.uploader,
			count: g._count.id,
			thumbnail: thumbMap.get(g.uploader!) ?? null,
		}))
	);
};
