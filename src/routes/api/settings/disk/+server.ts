import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { statfs } from 'fs/promises';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.session?.user?.isAdmin) {
		throw error(403, 'Admin access required');
	}

	const settings = await prisma.settings.findUnique({
		where: { id: 'singleton' },
	});

	const downloadPath = settings?.downloadPath || '/downloads';

	try {
		const stats = await statfs(downloadPath);
		const totalBytes = stats.bsize * stats.blocks;
		const availableBytes = stats.bsize * stats.bavail;

		return json({ totalBytes: String(totalBytes), availableBytes: String(availableBytes) });
	} catch {
		throw error(500, 'Could not determine disk space for download path');
	}
};
