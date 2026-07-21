import { json, error } from '@sveltejs/kit';
import { load } from 'js-yaml';
import { prisma } from '$lib/server/db';
import { apiRoute } from '$lib/server/openapi';
import { requireAdmin } from '$lib/server/guards';
import {
	validateSettingsUpdate,
	applySettingsSideEffects,
	serializeSettingsResponse,
} from '$lib/server/services/settings-validation';
import type { RequestHandler } from './$types';

interface SettingsChange {
	field: string;
	from: unknown;
	to: unknown;
}

function normalize(value: unknown): unknown {
	return typeof value === 'bigint' ? value.toString() : value;
}

function sameValue(a: unknown, b: unknown): boolean {
	if (Array.isArray(a) || Array.isArray(b)) {
		return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
	}
	return a === b;
}

/** Diff a validated updates object against the currently persisted settings. */
function diffSettings(current: Record<string, unknown>, updates: Record<string, unknown>): SettingsChange[] {
	const changes: SettingsChange[] = [];
	for (const [field, rawTo] of Object.entries(updates)) {
		const from = normalize(current[field]) ?? null;
		const to = normalize(rawTo) ?? null;
		if (!sameValue(from, to)) {
			changes.push({ field, from, to });
		}
	}
	return changes;
}

export const POST = apiRoute('/api/settings/import', 'POST', {
	summary: 'Import application settings from YAML',
	description: 'Admin-only, two-phase. Call with confirm: false (or omitted) to preview the changes a config file would make without writing anything; call again with confirm: true to apply them.',
	tags: ['Settings'],
	auth: 'admin',
	body: {
		yaml: { type: 'string', description: 'YAML config content (as produced by GET /api/settings/export)' },
		confirm: { type: 'boolean', description: 'Set true to actually persist the change; omit/false to preview only' },
	},
	responses: {
		200: {
			description: 'Preview of changes, or the updated settings if confirmed',
			schema: { type: 'object' },
		},
	},
}, async ({ request, locals }) => {
	try {
		requireAdmin(locals);

		const body = await request.json();
		if (typeof body.yaml !== 'string' || !body.yaml.trim()) {
			throw error(400, 'Missing yaml content');
		}

		let parsed: unknown;
		try {
			parsed = load(body.yaml);
		} catch (e: any) {
			throw error(400, `Invalid YAML: ${e.message}`);
		}

		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			throw error(400, 'Invalid YAML: expected a mapping of settings keys');
		}

		// Re-run full validation every time (preview AND confirm) — never trust a
		// client-held preview, since settings may have changed between the two calls.
		const updates = await validateSettingsUpdate(parsed as Record<string, any>);

		const currentSettings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
		if (!currentSettings) {
			throw error(500, 'Settings not initialized');
		}

		const changes = diffSettings(currentSettings as unknown as Record<string, unknown>, updates);

		if (body.confirm !== true) {
			return json({ preview: true, changes });
		}

		const settings = await prisma.settings.update({
			where: { id: 'singleton' },
			data: updates,
		});

		await applySettingsSideEffects(updates);

		return json({ preview: false, changes, settings: serializeSettingsResponse(settings) });
	} catch (e: any) {
		console.error('Failed to import settings:', e);
		if (e.status) throw e;
		throw error(500, 'Internal server error');
	}
}) satisfies RequestHandler;
