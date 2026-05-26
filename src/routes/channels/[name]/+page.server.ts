import { error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.session?.user?.id) {
		throw error(401, 'Authentication required');
	}

	const channelName = decodeURIComponent(params.name);

	const downloads = await prisma.download.findMany({
		where: {
			userId: locals.session.user.id,
			status: 'COMPLETED',
			uploader: channelName,
		},
		orderBy: { completedAt: 'desc' },
	});

	if (downloads.length === 0) {
		throw error(404, 'Channel not found');
	}

	// Find a thumbnail for the channel (first download that has one)
	const channelThumbnail = downloads.find((d) => d.thumbnail)?.thumbnail ?? null;

	const serialized = downloads.map((d) => ({
		...d,
		filesize: d.filesize?.toString() ?? null,
		downloadedBytes: d.downloadedBytes?.toString() ?? null,
		totalBytes: d.totalBytes?.toString() ?? null,
	}));

	return {
		channelName,
		channelThumbnail,
		downloads: serialized,
	};
};
