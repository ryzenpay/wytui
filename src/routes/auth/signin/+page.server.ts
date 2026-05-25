import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { issueSessionCookie } from '$lib/server/auth';
import { isOidcConfigured, getOidcDisplayName } from '$lib/server/oidc';
import { isLdapEnabled, authenticateLdap } from '$lib/server/ldap';
import bcrypt from 'bcrypt';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.session?.user) {
		throw redirect(303, '/');
	}

	const oidcConfigured = isOidcConfigured();
	const ldapEnabled = await isLdapEnabled();
	let authMode = 'password';
	if (oidcConfigured) {
		const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
		authMode = settings?.authMode || 'password';
	}

	return {
		setupComplete: url.searchParams.get('setup') === 'complete',
		error: url.searchParams.get('error') || null,
		oidcConfigured,
		oidcDisplayName: oidcConfigured ? getOidcDisplayName() : null,
		authMode,
		ldapEnabled,
		fallback: url.searchParams.get('fallback') === 'password',
	};
};

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString();
		const password = data.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required', email });
		}

		// Try LDAP authentication first if enabled
		const ldapEnabled = await isLdapEnabled();
		if (ldapEnabled) {
			try {
				const ldapUser = await authenticateLdap(email, password);
				if (ldapUser) {
					let user = await prisma.user.findUnique({ where: { email: ldapUser.email } });
					if (!user) {
						user = await prisma.user.create({
							data: {
								email: ldapUser.email,
								name: ldapUser.name,
								emailVerified: new Date(),
							},
						});
					}

					issueSessionCookie(cookies, {
						id: user.id,
						email: user.email,
						isAdmin: user.isAdmin,
					});

					throw redirect(303, '/');
				}
			} catch (e) {
				if (e instanceof Response || (e && typeof e === 'object' && 'status' in e && (e as any).status === 303)) throw e;
				// LDAP failed, fall through to password auth
			}
		}

		// Local password authentication
		const user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user || !user.password) {
			return fail(400, { error: 'Invalid email or password', email });
		}

		const isValidPassword = await bcrypt.compare(password, user.password);

		if (!isValidPassword) {
			return fail(400, { error: 'Invalid email or password', email });
		}

		issueSessionCookie(cookies, {
			id: user.id,
			email: user.email,
			isAdmin: user.isAdmin,
		});

		throw redirect(303, '/');
	},
} satisfies Actions;
