import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { apiRoute } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface VersionCache {
	currentVersion: string;
	latestVersion: string;
	updateAvailable: boolean;
	releaseUrl: string;
	checkedAt: number;
}

let cache: VersionCache | null = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

function getCurrentVersion(): string {
	try {
		const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
		return pkg.version || '0.0.0';
	} catch {
		return '0.0.0';
	}
}

function compareVersions(current: string, latest: string): boolean {
	const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
	const c = parse(current);
	const l = parse(latest);
	for (let i = 0; i < Math.max(c.length, l.length); i++) {
		const cv = c[i] || 0;
		const lv = l[i] || 0;
		if (lv > cv) return true;
		if (lv < cv) return false;
	}
	return false;
}

export const GET = apiRoute('/api/version', 'GET', {
	summary: 'Check for app updates',
	description: 'Compares current app version with latest GitHub release. Results are cached for 1 hour.',
	tags: ['Settings'],
	auth: true,
	responses: {
		200: {
			description: 'Version check result',
			schema: {
				type: 'object',
				properties: {
					currentVersion: { type: 'string' },
					latestVersion: { type: 'string' },
					updateAvailable: { type: 'boolean' },
					releaseUrl: { type: 'string' },
				},
			},
		},
	},
}, async ({ locals }) => {
	if (!locals.session?.user?.id) {
		throw error(401, 'Authentication required');
	}

	// Check if version checking is enabled
	const settings = await prisma.settings.findUnique({
		where: { id: 'singleton' },
		select: { versionCheckEnabled: true },
	});

	if (!settings?.versionCheckEnabled) {
		const currentVersion = getCurrentVersion();
		return json({
			currentVersion,
			latestVersion: currentVersion,
			updateAvailable: false,
			releaseUrl: '',
		});
	}

	// Return cached result if still fresh
	if (cache && Date.now() - cache.checkedAt < CACHE_DURATION_MS) {
		return json({
			currentVersion: cache.currentVersion,
			latestVersion: cache.latestVersion,
			updateAvailable: cache.updateAvailable,
			releaseUrl: cache.releaseUrl,
		});
	}

	const currentVersion = getCurrentVersion();

	try {
		const res = await fetch('https://api.github.com/repos/willuhmjs/wytui/releases/latest', {
			headers: {
				'Accept': 'application/vnd.github.v3+json',
				'User-Agent': `wytui/${currentVersion}`,
			},
		});

		if (!res.ok) {
			// GitHub API error — return current version without update info
			return json({
				currentVersion,
				latestVersion: currentVersion,
				updateAvailable: false,
				releaseUrl: '',
			});
		}

		const release = await res.json();
		const latestVersion = (release.tag_name || '').replace(/^v/, '');
		const releaseUrl = release.html_url || `https://github.com/willuhmjs/wytui/releases`;
		const updateAvailable = compareVersions(currentVersion, latestVersion);

		cache = {
			currentVersion,
			latestVersion,
			updateAvailable,
			releaseUrl,
			checkedAt: Date.now(),
		};

		return json({
			currentVersion,
			latestVersion,
			updateAvailable,
			releaseUrl,
		});
	} catch {
		// Network error — gracefully degrade
		return json({
			currentVersion,
			latestVersion: currentVersion,
			updateAvailable: false,
			releaseUrl: '',
		});
	}
}) satisfies RequestHandler;
