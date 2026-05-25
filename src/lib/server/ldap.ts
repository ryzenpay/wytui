import { Client } from 'ldapts';
import { prisma } from './db';

interface LdapUser {
	email: string;
	name: string;
}

async function getLdapSettings() {
	const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
	if (!settings?.ldapEnabled || !settings.ldapUrl || !settings.ldapSearchBase) {
		return null;
	}
	return {
		url: settings.ldapUrl,
		bindDn: settings.ldapBindDn || '',
		bindPassword: settings.ldapBindPassword || '',
		searchBase: settings.ldapSearchBase,
		searchFilter: settings.ldapSearchFilter || '(uid={{username}})',
	};
}

export async function isLdapEnabled(): Promise<boolean> {
	const settings = await getLdapSettings();
	return settings !== null;
}

export async function authenticateLdap(username: string, password: string): Promise<LdapUser | null> {
	const config = await getLdapSettings();
	if (!config) throw new Error('LDAP is not configured');

	const client = new Client({ url: config.url });

	try {
		if (config.bindDn) {
			await client.bind(config.bindDn, config.bindPassword);
		}

		const filter = config.searchFilter.replace(/\{\{username\}\}/g, username);

		const { searchEntries } = await client.search(config.searchBase, {
			filter,
			scope: 'sub',
			attributes: ['dn', 'mail', 'email', 'cn', 'displayName', 'uid', 'sAMAccountName'],
		});

		if (searchEntries.length === 0) return null;

		const entry = searchEntries[0];
		const userDn = entry.dn;

		await client.unbind();

		const userClient = new Client({ url: config.url });
		try {
			await userClient.bind(userDn, password);
		} catch {
			return null;
		} finally {
			await userClient.unbind().catch(() => {});
		}

		const email = (entry.mail || entry.email || `${username}@ldap`) as string;
		const name = (entry.displayName || entry.cn || username) as string;

		return { email: Array.isArray(email) ? email[0] : email, name: Array.isArray(name) ? name[0] : name };
	} catch (e) {
		console.error('[LDAP] Authentication error:', e);
		throw new Error('LDAP authentication failed');
	} finally {
		await client.unbind().catch(() => {});
	}
}
