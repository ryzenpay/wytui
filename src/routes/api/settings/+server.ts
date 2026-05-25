import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { queueService } from '$lib/server/services/queue.service';
import { isOidcConfigured, getOidcDisplayName } from '$lib/server/oidc';
import { resolve, normalize } from 'path';
import { statfs } from 'fs/promises';
import { apiRoute } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

const ALLOWED_SETTINGS_FIELDS = new Set([
	'maxConcurrentDownloads',
	'downloadPath',
	'ytdlpPath',
	'autoUpdateYtdlp',
	'updateCheckInterval',
	'enableArchive',
	'archivePath',
	'authMode',
	'libraryPath',
	'musicLibraryPath',
	'cacheQuotaBytes',
	'jellyfinUrl',
	'jellyfinApiKey',
	'jellyfinExternalUrl',
	'maxDurationSeconds',
	'cleanupEnabled',
	'cleanupUserIds',
	'cleanupIntervalSeconds',
	'cleanupProfileTypes',
	'cleanupGraceHours',
	'autoDeleteWatchedDays',
	'appriseUrl',
	'notifyOnComplete',
	'notifyOnFail',
	'backupEnabled',
	'backupCron',
	'backupPath',
	'ldapEnabled',
	'ldapUrl',
	'ldapBindDn',
	'ldapBindPassword',
	'ldapSearchBase',
	'ldapSearchFilter',
]);

export const GET = apiRoute('/api/settings', 'GET', {
	summary: 'Get application settings',
	description: 'Returns limited settings for regular users, full settings for admins',
	tags: ['Settings'],
	auth: true,
	responses: {
		200: {
			description: 'Settings object (scope varies by role)',
			schema: {
				type: 'object',
				properties: {
					maxConcurrentDownloads: { type: 'integer' },
					downloadPath: { type: 'string' },
					ytdlpPath: { type: 'string' },
					autoUpdateYtdlp: { type: 'boolean' },
					enableArchive: { type: 'boolean' },
					authMode: { type: 'string' },
					libraryPath: { type: 'string', nullable: true },
					musicLibraryPath: { type: 'string', nullable: true },
					cacheQuotaBytes: { type: 'string' },
					jellyfinUrl: { type: 'string', nullable: true },
					jellyfinApiKey: { type: 'string', nullable: true },
					oidcConfigured: { type: 'boolean' },
					maxDurationSeconds: { type: 'integer', nullable: true },
				},
			},
		},
	},
}, async ({ locals }) => {
	try {
		if (!locals.session?.user?.id) {
			throw error(401, 'Authentication required');
		}

		let settings = await prisma.settings.findUnique({
			where: { id: 'singleton' },
		});

		if (!settings) {
			settings = await prisma.settings.create({
				data: { id: 'singleton' },
			});
		}

		if (!locals.session.user.isAdmin) {
			return json({
				libraryPath: settings.libraryPath,
				musicLibraryPath: settings.musicLibraryPath,
				cacheQuotaBytes: settings.cacheQuotaBytes.toString(),
			});
		}

		let canUsePasswordOnly = true;
		if (isOidcConfigured()) {
			const adminWithPassword = await prisma.user.findFirst({
				where: {
					isAdmin: true,
					password: { not: null },
				},
			});
			canUsePasswordOnly = !!adminWithPassword;
		}

		return json({
			...settings,
			cacheQuotaBytes: settings.cacheQuotaBytes.toString(),
			oidcConfigured: isOidcConfigured(),
			oidcDisplayName: isOidcConfigured() ? getOidcDisplayName() : null,
			canUsePasswordOnly,
		});
	} catch (e: any) {
		console.error('Failed to get settings:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to get settings');
	}
}) satisfies RequestHandler;

export const PATCH = apiRoute('/api/settings', 'PATCH', {
	summary: 'Update application settings',
	tags: ['Settings'],
	auth: 'admin',
	body: {
		maxConcurrentDownloads: { type: 'integer', description: 'Max concurrent downloads (1-20)', minimum: 1, maximum: 20 },
		downloadPath: { type: 'string', description: 'Download directory path' },
		ytdlpPath: { type: 'string', description: 'Path to yt-dlp binary' },
		autoUpdateYtdlp: { type: 'boolean', description: 'Auto-update yt-dlp' },
		updateCheckInterval: { type: 'integer', description: 'Update check interval (seconds)' },
		enableArchive: { type: 'boolean', description: 'Enable download archive' },
		archivePath: { type: 'string', description: 'Archive file path' },
		authMode: { type: 'string', description: 'Authentication mode', enum: ['password', 'oidc', 'both'] },
		libraryPath: { type: 'string', description: 'Library directory path' },
		musicLibraryPath: { type: 'string', description: 'Music library path' },
		cacheQuotaBytes: { type: 'string', description: 'Cache quota in bytes' },
		jellyfinUrl: { type: 'string', description: 'Jellyfin server URL' },
		jellyfinApiKey: { type: 'string', description: 'Jellyfin API key' },
		jellyfinExternalUrl: { type: 'string', description: 'Jellyfin external URL' },
		maxDurationSeconds: { type: 'integer', description: 'Max download duration (0 = unlimited)', minimum: 0 },
		autoDeleteWatchedDays: { type: 'integer', description: 'Auto-delete watched videos after N days (null = disabled)', nullable: true, minimum: 0 },
		appriseUrl: { type: 'string', description: 'Apprise notification server URL', nullable: true },
		notifyOnComplete: { type: 'boolean', description: 'Send notification on download complete' },
		notifyOnFail: { type: 'boolean', description: 'Send notification on download failure' },
		backupEnabled: { type: 'boolean', description: 'Enable scheduled backups' },
		backupCron: { type: 'string', description: 'Backup cron schedule', nullable: true },
		backupPath: { type: 'string', description: 'Backup directory path', nullable: true },
		ldapEnabled: { type: 'boolean', description: 'Enable LDAP authentication' },
		ldapUrl: { type: 'string', description: 'LDAP server URL', nullable: true },
		ldapBindDn: { type: 'string', description: 'LDAP bind DN', nullable: true },
		ldapBindPassword: { type: 'string', description: 'LDAP bind password', nullable: true },
		ldapSearchBase: { type: 'string', description: 'LDAP search base DN', nullable: true },
		ldapSearchFilter: { type: 'string', description: 'LDAP search filter template', nullable: true },
	},
	responses: {
		200: {
			description: 'Updated settings object',
			schema: {
				type: 'object',
				properties: {
					maxConcurrentDownloads: { type: 'integer' },
					downloadPath: { type: 'string' },
					ytdlpPath: { type: 'string' },
					autoUpdateYtdlp: { type: 'boolean' },
					enableArchive: { type: 'boolean' },
					authMode: { type: 'string' },
					libraryPath: { type: 'string', nullable: true },
					musicLibraryPath: { type: 'string', nullable: true },
					cacheQuotaBytes: { type: 'string' },
					jellyfinUrl: { type: 'string', nullable: true },
					jellyfinApiKey: { type: 'string', nullable: true },
					oidcConfigured: { type: 'boolean' },
					maxDurationSeconds: { type: 'integer', nullable: true },
				},
			},
		},
	},
}, async ({ request, locals }) => {
	try {
		if (!locals.session?.user?.isAdmin) {
			throw error(403, 'Admin access required');
		}

		const body = await request.json();

		const updates: Record<string, any> = {};
		for (const key of Object.keys(body)) {
			if (!ALLOWED_SETTINGS_FIELDS.has(key)) {
				throw error(400, `Unknown setting: ${key}`);
			}
			updates[key] = body[key];
		}

		if (updates.downloadPath !== undefined) {
			const normalized = normalize(resolve(updates.downloadPath));
			if (normalized.includes('..')) {
				throw error(400, 'Invalid download path');
			}
			updates.downloadPath = normalized;
		}

		if (updates.ytdlpPath !== undefined) {
			const normalized = normalize(resolve(updates.ytdlpPath));
			if (normalized.includes('..')) {
				throw error(400, 'Invalid yt-dlp path');
			}
			updates.ytdlpPath = normalized;
		}

		if (updates.authMode !== undefined) {
			if (!['password', 'oidc', 'both'].includes(updates.authMode)) {
				throw error(400, 'Invalid auth mode');
			}

			if (updates.authMode === 'password') {
				const adminWithPassword = await prisma.user.findFirst({
					where: {
						isAdmin: true,
						password: { not: null },
					},
				});
				if (!adminWithPassword) {
					throw error(400, 'Cannot switch to password-only authentication: no admin accounts have a password set. Create a password for an admin account first.');
				}
			}
		}

		if (updates.libraryPath !== undefined && updates.libraryPath !== null) {
			const normalized = normalize(resolve(updates.libraryPath));
			if (normalized.includes('..')) {
				throw error(400, 'Invalid library path');
			}
			updates.libraryPath = normalized;
		}

		if (updates.musicLibraryPath !== undefined && updates.musicLibraryPath !== null) {
			const normalized = normalize(resolve(updates.musicLibraryPath));
			if (normalized.includes('..')) {
				throw error(400, 'Invalid music library path');
			}
			updates.musicLibraryPath = normalized;
		}

		if (updates.cacheQuotaBytes !== undefined) {
			const val = BigInt(updates.cacheQuotaBytes);
			if (val < BigInt(0)) {
				throw error(400, 'Cache quota must be positive');
			}

			const currentSettings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
			const downloadPath = updates.downloadPath || currentSettings?.downloadPath || '/downloads';
			try {
				const stats = await statfs(downloadPath);
				const totalBytes = BigInt(stats.bsize) * BigInt(stats.blocks);
				if (val > totalBytes) {
					const totalGB = Number(totalBytes) / (1024 * 1024 * 1024);
					throw error(400, `Cache quota exceeds total disk space (${totalGB.toFixed(1)} GB)`);
				}
			} catch (e: any) {
				if (e.status) throw e;
			}

			updates.cacheQuotaBytes = val;
		}

		if (updates.maxConcurrentDownloads !== undefined) {
			const val = Number(updates.maxConcurrentDownloads);
			if (!Number.isInteger(val) || val < 1 || val > 20) {
				throw error(400, 'maxConcurrentDownloads must be between 1 and 20');
			}
			queueService.setMaxConcurrent(val);
		}

		if (updates.maxDurationSeconds !== undefined) {
			const val = Number(updates.maxDurationSeconds);
			if (!Number.isInteger(val) || val < 0) {
				throw error(400, 'maxDurationSeconds must be a non-negative integer');
			}
		}

		if (updates.cleanupIntervalSeconds !== undefined) {
			const val = Number(updates.cleanupIntervalSeconds);
			if (!Number.isInteger(val) || val < 600 || val > 86400) {
				throw error(400, 'cleanupIntervalSeconds must be between 600 and 86400');
			}
		}

		if (updates.cleanupGraceHours !== undefined) {
			const val = Number(updates.cleanupGraceHours);
			if (!Number.isInteger(val) || val < 0 || val > 720) {
				throw error(400, 'cleanupGraceHours must be between 0 and 720');
			}
		}

		if (updates.cleanupUserIds !== undefined) {
			if (!Array.isArray(updates.cleanupUserIds) || !updates.cleanupUserIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
				throw error(400, 'cleanupUserIds must be an array of non-empty strings');
			}
		}

		if (updates.cleanupProfileTypes !== undefined) {
			const allowed = ['video', 'music'];
			if (!Array.isArray(updates.cleanupProfileTypes) || !updates.cleanupProfileTypes.every((t: unknown) => allowed.includes(t as string))) {
				throw error(400, 'cleanupProfileTypes must only contain "video" or "music"');
			}
		}

		const settings = await prisma.settings.update({
			where: { id: 'singleton' },
			data: updates,
		});

		if (
			updates.cleanupEnabled !== undefined ||
			updates.cleanupIntervalSeconds !== undefined ||
			updates.cleanupUserIds !== undefined
		) {
			const { jobScheduler } = await import('$lib/server/jobs/scheduler');
			await jobScheduler.restartCleanupTask();
		}

		return json({
			...settings,
			cacheQuotaBytes: settings.cacheQuotaBytes.toString(),
		});
	} catch (e: any) {
		console.error('Failed to update settings:', e);
		if (e.status) throw e;
		throw error(500, e.message || 'Failed to update settings');
	}
}) satisfies RequestHandler;
