import { randomBytes } from 'crypto';
import type { Cookies } from '@sveltejs/kit';

const CSRF_COOKIE_NAME = 'wytui.csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate or retrieve existing CSRF token for the session
 */
export function getOrCreateCsrfToken(cookies: Cookies): string {
	const existingToken = cookies.get(CSRF_COOKIE_NAME);
	if (existingToken) {
		return existingToken;
	}

	const newToken = randomBytes(32).toString('hex');
	cookies.set(CSRF_COOKIE_NAME, newToken, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24, // 24 hours
	});

	return newToken;
}

/**
 * Validate CSRF token from request
 * Returns true if valid, false otherwise
 */
export function validateCsrfToken(cookies: Cookies, request: Request): boolean {
	const cookieToken = cookies.get(CSRF_COOKIE_NAME);
	if (!cookieToken) {
		return false;
	}

	// Check token in header first (for fetch/axios requests)
	const headerToken = request.headers.get(CSRF_HEADER_NAME);
	if (headerToken) {
		return headerToken === cookieToken;
	}

	// For form submissions, check in FormData
	// This will be handled at the form action level
	return false;
}

/**
 * Check if request should be exempt from CSRF validation
 */
export function isCsrfExempt(request: Request): boolean {
	// GET, HEAD, OPTIONS are safe methods
	if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
		return true;
	}

	// Bearer token authentication (API keys) are exempt
	const authHeader = request.headers.get('authorization');
	if (authHeader?.startsWith('Bearer ')) {
		return true;
	}

	// Browser extension origins are trusted (chrome-extension://, moz-extension://, etc.)
	const origin = request.headers.get('origin');
	if (origin && /^(chrome-extension|moz-extension|safari-web-extension):\/\//.test(origin)) {
		return true;
	}

	return false;
}
