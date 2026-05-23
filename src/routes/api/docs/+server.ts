import { json } from '@sveltejs/kit';
import { buildSpec } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

const modules = import.meta.glob('/src/routes/api/**/+server.ts', { eager: true });

export const GET: RequestHandler = async () => {
	return json(buildSpec());
};
