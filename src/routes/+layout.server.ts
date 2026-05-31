import type { LayoutServerLoad } from './$types';
import { getOrCreateCsrfToken } from '$lib/server/csrf';
import { prisma } from '$lib/server/db';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const csrfToken = getOrCreateCsrfToken(cookies);

	// Visibility flags for the sidebar stats panel (admins always see stats).
	const settings = await prisma.settings.findUnique({
		where: { id: 'singleton' },
		select: { statsVisibleToNonAdmins: true, showTotalSizeToNonAdmins: true },
	});

	return {
		session: locals.session || null,
		csrfToken,
		statsVisibleToNonAdmins: settings?.statsVisibleToNonAdmins ?? true,
		showTotalSizeToNonAdmins: settings?.showTotalSizeToNonAdmins ?? false,
	};
};
