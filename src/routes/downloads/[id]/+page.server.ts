import { error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.session?.user?.id) {
		throw error(401, 'Authentication required');
	}

	const download = await prisma.download.findUnique({
		where: { id: params.id },
		include: {
			profile: true,
			watchProgress: {
				where: { userId: locals.session.user.id },
				take: 1,
			},
		},
	});

	if (!download) {
		throw error(404, 'Download not found');
	}

	if (download.userId !== locals.session.user.id && !locals.session.user.isAdmin) {
		throw error(403, 'Access denied');
	}

	const settings = await prisma.settings.findUnique({
		where: { id: 'singleton' },
	});

	const serialized = {
		...download,
		filesize: download.filesize?.toString() ?? null,
		downloadedBytes: download.downloadedBytes?.toString() ?? null,
		totalBytes: download.totalBytes?.toString() ?? null,
		watchProgress: download.watchProgress[0] ?? null,
	};

	return {
		download: serialized,
		jellyfinUrl: settings?.jellyfinExternalUrl || settings?.jellyfinUrl || '',
	};
};
