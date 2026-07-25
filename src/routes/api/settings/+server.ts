import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { queueService } from '$lib/server/services/queue.service';
import { isOidcConfigured, getOidcDisplayName, isOidcManagedByEnv } from '$lib/server/oidc';
import { isLdapManagedByEnv } from '$lib/server/ldap';
import { encryptSecret } from '$lib/server/utils/crypto-box';
import { resolve, normalize } from 'path';
import { statfs } from 'fs/promises';
import { apiRoute } from '$lib/server/openapi';
import { requireAdmin } from '$lib/server/guards';
import { libraryAccessStatus, effectiveCacheQuota } from '$lib/server/permissions';
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
	'totalCacheQuotaBytes',
	'jellyfinUrl',
	'jellyfinApiKey',
	'jellyfinExternalUrl',
	'plexUrl',
	'plexToken',
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
	'oidcEnabled',
	'oidcIssuerUrl',
	'oidcClientId',
	'oidcClientSecret',
	'oidcDisplayName',
	'rateLimit',
	'sleepInterval',
	'proxyAuthEnabled',
	'proxyAuthHeader',
	'versionCheckEnabled',
	'rydEnabled',
	'libraryAccessMode',
	'statsVisibleToNonAdmins',
	'showTotalSizeToNonAdmins',
	'concurrentFragments',
	'useAria2c',
	'httpChunkSize',
	'generateJellyfinPosters',
]);

export const GET = apiRoute(
	'/api/settings',
	'GET',
	{
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
	},
	async ({ locals }) => {
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
				const user = await prisma.user.findUnique({
					where: { id: locals.session.user.id },
					select: { libraryAccess: true, isAdmin: true, cacheQuotaBytes: true },
				});
				const access = libraryAccessStatus(user, settings);
				const libraryConfigured = !!settings.libraryPath;
				return json({
					libraryAccess: access, // 'allowed' | 'request' | 'denied'
					canUseLibrary: access === 'allowed' && libraryConfigured,
					canRequestLibrary: access === 'request' && libraryConfigured,
					cacheQuotaBytes: effectiveCacheQuota(user, settings).toString(),
				});
			}

			const oidcConfigured = await isOidcConfigured();
			const oidcManagedByEnv = await isOidcManagedByEnv();
			const ldapManagedByEnv = await isLdapManagedByEnv();

			let canUsePasswordOnly = true;
			if (oidcConfigured) {
				const adminWithPassword = await prisma.user.findFirst({
					where: {
						isAdmin: true,
						password: { not: null },
					},
				});
				canUsePasswordOnly = !!adminWithPassword;
			}

			// Redact sensitive fields - show only if they're set, not the actual values
			return json({
				...settings,
				jellyfinApiKey: settings.jellyfinApiKey ? '***SET***' : null,
				plexToken: settings.plexToken ? '***SET***' : null,
				ldapBindPassword: settings.ldapBindPassword ? '***SET***' : null,
				oidcClientSecret: settings.oidcClientSecret ? '***SET***' : null,
				appriseUrl: settings.appriseUrl ? '***SET***' : null,
				cacheQuotaBytes: settings.cacheQuotaBytes.toString(),
				totalCacheQuotaBytes: settings.totalCacheQuotaBytes?.toString() ?? null,
				oidcConfigured,
				oidcManagedByEnv,
				ldapManagedByEnv,
				oidcDisplayName: oidcConfigured ? await getOidcDisplayName() : null,
				canUsePasswordOnly,
			});
		} catch (e: any) {
			console.error('Failed to get settings:', e);
			if (e.status) throw e;
			throw error(500, 'Internal server error');
		}
	},
) satisfies RequestHandler;

export const PATCH = apiRoute(
	'/api/settings',
	'PATCH',
	{
		summary: 'Update application settings',
		tags: ['Settings'],
		auth: 'admin',
		body: {
			maxConcurrentDownloads: {
				type: 'integer',
				description: 'Max concurrent downloads (1-20)',
				minimum: 1,
				maximum: 20,
			},
			downloadPath: { type: 'string', description: 'Download directory path' },
			ytdlpPath: { type: 'string', description: 'Path to yt-dlp binary' },
			autoUpdateYtdlp: { type: 'boolean', description: 'Auto-update yt-dlp' },
			updateCheckInterval: { type: 'integer', description: 'Update check interval (seconds)' },
			enableArchive: { type: 'boolean', description: 'Enable download archive' },
			archivePath: { type: 'string', description: 'Archive file path' },
			authMode: {
				type: 'string',
				description: 'Authentication mode',
				enum: ['password', 'oidc', 'both'],
			},
			libraryPath: { type: 'string', description: 'Library directory path' },
			musicLibraryPath: { type: 'string', description: 'Music library path' },
			cacheQuotaBytes: { type: 'string', description: 'Default per-user cache quota in bytes' },
			totalCacheQuotaBytes: {
				type: 'string',
				description: 'Global total cache cap in bytes; empty/null = auto (disk − 5 GB)',
				nullable: true,
			},
			jellyfinUrl: { type: 'string', description: 'Jellyfin server URL' },
			jellyfinApiKey: { type: 'string', description: 'Jellyfin API key' },
			jellyfinExternalUrl: { type: 'string', description: 'Jellyfin external URL' },
			plexUrl: { type: 'string', description: 'Plex server URL', nullable: true },
			plexToken: { type: 'string', description: 'Plex authentication token', nullable: true },
			maxDurationSeconds: {
				type: 'integer',
				description: 'Max download duration (0 = unlimited)',
				minimum: 0,
			},
			autoDeleteWatchedDays: {
				type: 'integer',
				description: 'Auto-delete watched videos after N days (null = disabled)',
				nullable: true,
				minimum: 0,
			},
			appriseUrl: {
				type: 'string',
				description: 'Apprise notification server URL',
				nullable: true,
			},
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
			ldapSearchFilter: {
				type: 'string',
				description: 'LDAP search filter template',
				nullable: true,
			},
			oidcEnabled: {
				type: 'boolean',
				description:
					'Enable OIDC SSO configured via the GUI (ignored when OIDC_* env vars are set)',
			},
			oidcIssuerUrl: { type: 'string', description: 'OIDC issuer URL', nullable: true },
			oidcClientId: { type: 'string', description: 'OIDC client ID', nullable: true },
			oidcClientSecret: {
				type: 'string',
				description: 'OIDC client secret (stored encrypted)',
				nullable: true,
			},
			oidcDisplayName: { type: 'string', description: 'OIDC sign-in button label', nullable: true },
			rateLimit: {
				type: 'string',
				description: 'Download speed limit (e.g. "5M" for 5MB/s)',
				nullable: true,
			},
			sleepInterval: {
				type: 'integer',
				description: 'Seconds to wait between downloads',
				nullable: true,
				minimum: 0,
			},
			proxyAuthEnabled: {
				type: 'boolean',
				description: 'Enable reverse-proxy authentication headers',
			},
			proxyAuthHeader: {
				type: 'string',
				description: 'Header name for proxy auth (e.g. X-Forwarded-User)',
			},
			versionCheckEnabled: {
				type: 'boolean',
				description: 'Enable automatic version update checks',
			},
			rydEnabled: { type: 'boolean', description: 'Enable Return YouTube Dislike integration' },
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
	},
	async ({ request, locals }) => {
		try {
			requireAdmin(locals);

			const body = await request.json();

			// Secret fields are masked as '***SET***' on GET; a client that echoes the
			// mask back must not overwrite the stored secret with the literal mask.
			const SECRET_FIELDS = new Set([
				'jellyfinApiKey',
				'plexToken',
				'ldapBindPassword',
				'appriseUrl',
				'oidcClientSecret',
			]);

			const updates: Record<string, any> = {};
			for (const key of Object.keys(body)) {
				if (!ALLOWED_SETTINGS_FIELDS.has(key)) {
					throw error(400, `Unknown setting: ${key}`);
				}
				if (SECRET_FIELDS.has(key) && body[key] === '***SET***') {
					continue; // unchanged masked secret — leave existing value untouched
				}
				updates[key] = body[key];
			}

			// OIDC/LDAP fields are read-only when governed by environment variables.
			const oidcFields = [
				'oidcEnabled',
				'oidcIssuerUrl',
				'oidcClientId',
				'oidcClientSecret',
				'oidcDisplayName',
			];
			if (oidcFields.some((f) => f in updates) && (await isOidcManagedByEnv())) {
				throw error(400, 'OIDC is managed by environment variables and cannot be edited here');
			}
			const ldapFields = [
				'ldapEnabled',
				'ldapUrl',
				'ldapBindDn',
				'ldapBindPassword',
				'ldapSearchBase',
				'ldapSearchFilter',
			];
			if (ldapFields.some((f) => f in updates) && (await isLdapManagedByEnv())) {
				throw error(400, 'LDAP is managed by environment variables and cannot be edited here');
			}

			// Encrypt secrets at rest. Empty string clears the secret (store null).
			if (updates.oidcClientSecret !== undefined) {
				updates.oidcClientSecret = updates.oidcClientSecret
					? encryptSecret(String(updates.oidcClientSecret))
					: null;
			}
			if (updates.ldapBindPassword !== undefined) {
				updates.ldapBindPassword = updates.ldapBindPassword
					? encryptSecret(String(updates.ldapBindPassword))
					: null;
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
						throw error(
							400,
							'Cannot switch to password-only authentication: no admin accounts have a password set. Create a password for an admin account first.',
						);
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

			if (updates.totalCacheQuotaBytes !== undefined) {
				// Empty string or null clears the override → auto (disk − 5 GB).
				if (updates.totalCacheQuotaBytes === null || updates.totalCacheQuotaBytes === '') {
					updates.totalCacheQuotaBytes = null;
				} else {
					const val = BigInt(updates.totalCacheQuotaBytes);
					if (val < BigInt(0)) {
						throw error(400, 'Total cache quota must be positive');
					}

					const currentSettings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
					const downloadPath =
						updates.downloadPath || currentSettings?.downloadPath || '/downloads';
					try {
						const stats = await statfs(downloadPath);
						const totalBytes = BigInt(stats.bsize) * BigInt(stats.blocks);
						if (val > totalBytes) {
							const totalGB = Number(totalBytes) / (1024 * 1024 * 1024);
							throw error(
								400,
								`Total cache quota exceeds total disk space (${totalGB.toFixed(1)} GB)`,
							);
						}
					} catch (e: any) {
						if (e.status) throw e;
					}

					updates.totalCacheQuotaBytes = val;
				}
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
				if (
					!Array.isArray(updates.cleanupUserIds) ||
					!updates.cleanupUserIds.every((id: unknown) => typeof id === 'string' && id.length > 0)
				) {
					throw error(400, 'cleanupUserIds must be an array of non-empty strings');
				}
			}

			if (updates.cleanupProfileTypes !== undefined) {
				const allowed = ['video', 'music'];
				if (
					!Array.isArray(updates.cleanupProfileTypes) ||
					!updates.cleanupProfileTypes.every((t: unknown) => allowed.includes(t as string))
				) {
					throw error(400, 'cleanupProfileTypes must only contain "video" or "music"');
				}
			}

			if (updates.rateLimit !== undefined && updates.rateLimit !== null) {
				const rateLimitPattern = /^\d+(\.\d+)?[KMG]?$/i;
				if (!rateLimitPattern.test(updates.rateLimit)) {
					throw error(
						400,
						'rateLimit must be a number optionally followed by K, M, or G (e.g. "5M")',
					);
				}
			}

			if (updates.sleepInterval !== undefined && updates.sleepInterval !== null) {
				const val = Number(updates.sleepInterval);
				if (!Number.isInteger(val) || val < 0 || val > 3600) {
					throw error(400, 'sleepInterval must be an integer between 0 and 3600');
				}
			}

			if (updates.proxyAuthHeader !== undefined) {
				const header = String(updates.proxyAuthHeader).trim();
				if (!header || !/^[a-zA-Z0-9-]+$/.test(header)) {
					throw error(
						400,
						'proxyAuthHeader must be a valid HTTP header name (letters, digits, hyphens)',
					);
				}
				updates.proxyAuthHeader = header;
			}

			if (updates.concurrentFragments !== undefined) {
				const val = Number(updates.concurrentFragments);
				if (!Number.isInteger(val) || val < 0 || val > 16) {
					throw error(400, 'concurrentFragments must be an integer between 0 and 16');
				}
			}

			if (updates.useAria2c !== undefined) {
				if (typeof updates.useAria2c !== 'boolean') {
					throw error(400, 'useAria2c must be a boolean');
				}
			}

			if (updates.httpChunkSize !== undefined) {
				// Allow null or empty string → coerce to null
				if (updates.httpChunkSize === null || updates.httpChunkSize === '') {
					updates.httpChunkSize = null;
				} else {
					if (typeof updates.httpChunkSize !== 'string') {
						throw error(400, 'httpChunkSize must be a string or null');
					}
					// Validate format: bare number or number with K/M/G suffix (e.g. "10M", "1.5G", "500K")
					const chunkSizePattern = /^\d+(\.\d+)?[KMGkmg]?$/;
					if (!chunkSizePattern.test(updates.httpChunkSize)) {
						throw error(
							400,
							'httpChunkSize must be a number optionally followed by K, M, or G (e.g. "10M", "1.5G", "500K")',
						);
					}
				}
			}

			if (updates.generateJellyfinPosters !== undefined) {
				if (typeof updates.generateJellyfinPosters !== 'boolean') {
					throw error(400, 'generateJellyfinPosters must be a boolean');
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
				jellyfinApiKey: settings.jellyfinApiKey ? '***SET***' : null,
				plexToken: settings.plexToken ? '***SET***' : null,
				ldapBindPassword: settings.ldapBindPassword ? '***SET***' : null,
				oidcClientSecret: settings.oidcClientSecret ? '***SET***' : null,
				appriseUrl: settings.appriseUrl ? '***SET***' : null,
				cacheQuotaBytes: settings.cacheQuotaBytes.toString(),
				totalCacheQuotaBytes: settings.totalCacheQuotaBytes?.toString() ?? null,
			});
		} catch (e: any) {
			console.error('Failed to update settings:', e);
			if (e.status) throw e;
			throw error(500, 'Internal server error');
		}
	},
) satisfies RequestHandler;
