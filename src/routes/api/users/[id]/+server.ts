import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { invalidateUsersCache } from '$lib/server/auth';
import { apiRoute } from '$lib/server/openapi';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const PATCH = apiRoute('/api/users/[id]', 'PATCH', {
	summary: 'Update a user',
	tags: ['Users'],
	auth: 'admin',
	params: { id: { type: 'string', description: 'User ID' } },
	body: {
		name: { type: 'string', description: 'Display name' },
		isAdmin: { type: 'boolean', description: 'Admin status' },
	},
	responses: {
		200: {
			description: 'Updated user',
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
		400: { description: 'Cannot demote last admin' },
	},
}, async ({ params, request, locals }) => {
	try {
		requireAdmin(locals);

		const updates = await request.json();

		if (updates.isAdmin === false) {
			const adminCount = await prisma.user.count({
				where: { isAdmin: true },
			});

			if (adminCount <= 1) {
				throw error(400, 'Cannot demote the last admin');
			}
		}

		const user = await prisma.user.update({
			where: { id: params.id },
			data: {
				name: updates.name,
				isAdmin: updates.isAdmin,
			},
			select: {
				id: true,
				email: true,
				name: true,
				isAdmin: true,
				createdAt: true,
			},
		});

		return json(user);
	} catch (e: any) {
		console.error('Failed to update user:', e);
		if (e.status) throw e;
		throw error(500, 'Internal server error');
	}
}) satisfies RequestHandler;

export const DELETE = apiRoute('/api/users/[id]', 'DELETE', {
	summary: 'Delete a user',
	tags: ['Users'],
	auth: 'admin',
	params: { id: { type: 'string', description: 'User ID' } },
	responses: {
		200: {
			description: 'User deleted',
			schema: {
				type: 'object',
				properties: {
					success: { type: 'boolean' },
				},
			},
		},
		400: { description: 'Cannot delete self or last admin' },
	},
}, async ({ params, locals }) => {
	try {
		requireAdmin(locals);

		if (params.id === locals.session.user.id) {
			throw error(400, 'Cannot delete yourself');
		}

		const user = await prisma.user.findUnique({
			where: { id: params.id },
		});

		if (user?.isAdmin) {
			const adminCount = await prisma.user.count({
				where: { isAdmin: true },
			});

			if (adminCount <= 1) {
				throw error(400, 'Cannot delete the last admin');
			}
		}

		await prisma.user.delete({
			where: { id: params.id },
		});

		invalidateUsersCache();
		return json({ success: true });
	} catch (e: any) {
		console.error('Failed to delete user:', e);
		if (e.status) throw e;
		throw error(500, 'Internal server error');
	}
}) satisfies RequestHandler;
