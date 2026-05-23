import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { hashPassword, validatePassword, invalidateUsersCache } from '$lib/server/auth';
import { apiRoute } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

export const GET = apiRoute('/api/users', 'GET', {
	summary: 'List all users',
	tags: ['Users'],
	auth: 'admin',
	responses: {
		200: {
			description: 'Array of users with download/subscription counts',
			schema: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						email: { type: 'string' },
						name: { type: 'string' },
						isAdmin: { type: 'boolean' },
						createdAt: { type: 'string', format: 'date-time' },
						_count: {
							type: 'object',
							properties: {
								downloads: { type: 'integer' },
								subscriptions: { type: 'integer' },
							},
						},
					},
				},
			},
		},
	},
}, async ({ locals }) => {
	try {
		if (!locals.session?.user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const users = await prisma.user.findMany({
			select: {
				id: true,
				email: true,
				name: true,
				isAdmin: true,
				createdAt: true,
				_count: {
					select: {
						downloads: true,
						subscriptions: true,
					},
				},
			},
			orderBy: { createdAt: 'desc' },
		});

		return json(users);
	} catch (e: any) {
		console.error('Failed to list users:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to list users');
	}
}) satisfies RequestHandler;

export const POST = apiRoute('/api/users', 'POST', {
	summary: 'Create a new user',
	tags: ['Users'],
	auth: 'admin',
	body: {
		email: { type: 'string', required: true, description: 'User email' },
		password: { type: 'string', required: true, description: 'User password' },
		name: { type: 'string', required: true, description: 'Display name' },
		isAdmin: { type: 'boolean', description: 'Grant admin privileges' },
	},
	responses: {
		201: {
			description: 'Created user',
			schema: {
				type: 'object',
				properties: {
					id: { type: 'string' },
					email: { type: 'string' },
					name: { type: 'string' },
					isAdmin: { type: 'boolean' },
					createdAt: { type: 'string', format: 'date-time' },
				},
			},
		},
		400: { description: 'Invalid input or user exists' },
	},
}, async ({ request, locals }) => {
	try {
		if (!locals.session?.user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const { email, password, name, isAdmin } = await request.json();

		if (!email || !password || !name) {
			throw error(400, 'Email, password, and name are required');
		}

		const passwordValidation = validatePassword(password);
		if (!passwordValidation.valid) {
			throw error(400, passwordValidation.error!);
		}

		const existing = await prisma.user.findUnique({
			where: { email },
		});

		if (existing) {
			throw error(400, 'User with this email already exists');
		}

		const hashedPassword = await hashPassword(password);

		const user = await prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				name,
				isAdmin: isAdmin || false,
			},
			select: {
				id: true,
				email: true,
				name: true,
				isAdmin: true,
				createdAt: true,
			},
		});

		invalidateUsersCache();
		return json(user, { status: 201 });
	} catch (e: any) {
		console.error('Failed to create user:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to create user');
	}
}) satisfies RequestHandler;
