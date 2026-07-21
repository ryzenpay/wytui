import { error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { queueService } from '$lib/server/services/queue.service';
import { resolve, normalize } from 'path';
import { statfs } from 'fs/promises';

export const ALLOWED_SETTINGS_FIELDS = new Set([
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
	'rateLimit',
	'sleepInterval',
	'proxyAuthEnabled',
	'proxyAuthHeader',
	'versionCheckEnabled',
	'rydEnabled',
	'libraryAccessMode',
	'statsVisibleToNonAdmins',
	'showTotalSizeToNonAdmins',
]);

/**
 * Validate and normalize a settings update payload against ALLOWED_SETTINGS_FIELDS.
 * Shared by PATCH and config import so both go through identical checks. Pure
 * validation only — no side effects (e.g. live queue concurrency changes) belong
 * here, since import previews call this without writing anything.
 */
export async function validateSettingsUpdate(body: Record<string, any>): Promise<Record<string, any>> {
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
			const downloadPath = updates.downloadPath || currentSettings?.downloadPath || '/downloads';
			try {
				const stats = await statfs(downloadPath);
				const totalBytes = BigInt(stats.bsize) * BigInt(stats.blocks);
				if (val > totalBytes) {
					const totalGB = Number(totalBytes) / (1024 * 1024 * 1024);
					throw error(400, `Total cache quota exceeds total disk space (${totalGB.toFixed(1)} GB)`);
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

	if (updates.rateLimit !== undefined && updates.rateLimit !== null) {
		const rateLimitPattern = /^\d+(\.\d+)?[KMG]?$/i;
		if (!rateLimitPattern.test(updates.rateLimit)) {
			throw error(400, 'rateLimit must be a number optionally followed by K, M, or G (e.g. "5M")');
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
			throw error(400, 'proxyAuthHeader must be a valid HTTP header name (letters, digits, hyphens)');
		}
		updates.proxyAuthHeader = header;
	}

	return updates;
}

/**
 * Side effects that should only fire once a settings update is actually persisted
 * (not during an import preview / dry run).
 */
export async function applySettingsSideEffects(updates: Record<string, any>): Promise<void> {
	if (updates.maxConcurrentDownloads !== undefined) {
		queueService.setMaxConcurrent(Number(updates.maxConcurrentDownloads));
	}

	if (
		updates.cleanupEnabled !== undefined ||
		updates.cleanupIntervalSeconds !== undefined ||
		updates.cleanupUserIds !== undefined
	) {
		const { jobScheduler } = await import('$lib/server/jobs/scheduler');
		await jobScheduler.restartCleanupTask();
	}
}

/** Shape a raw Settings row for JSON responses (stringify BigInt fields). */
export function serializeSettingsResponse(settings: { cacheQuotaBytes: bigint; totalCacheQuotaBytes: bigint | null; [key: string]: any }) {
	return {
		...settings,
		cacheQuotaBytes: settings.cacheQuotaBytes.toString(),
		totalCacheQuotaBytes: settings.totalCacheQuotaBytes?.toString() ?? null,
	};
}
