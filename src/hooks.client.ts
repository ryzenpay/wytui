import type { HandleFetch } from '@sveltejs/kit';
import { page } from '$app/stores';
import { get } from 'svelte/store';

/**
 * Client-side hook to automatically inject CSRF token into fetch requests
 */
export const handleFetch: HandleFetch = async ({ request, fetch }) => {
	// Get CSRF token from page store
	const pageData = get(page);
	const csrfToken = pageData?.data?.csrfToken;

	// Only add CSRF token for state-changing methods to same-origin requests
	if (
		csrfToken &&
		request.method &&
		!['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
		new URL(request.url).origin === window.location.origin
	) {
		request.headers.set('x-csrf-token', csrfToken);
	}

	return fetch(request);
};
