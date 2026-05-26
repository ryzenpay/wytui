import type { LayoutServerLoad } from './$types';
import { getOrCreateCsrfToken } from '$lib/server/csrf';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const csrfToken = getOrCreateCsrfToken(cookies);

	return {
		session: locals.session || null,
		csrfToken,
	};
};
