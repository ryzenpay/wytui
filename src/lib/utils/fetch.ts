import { page } from '$app/stores';
import { get } from 'svelte/store';

/**
 * Wrapper around fetch that automatically includes CSRF token
 */
export async function csrfFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
	const pageData = get(page);
	const csrfToken = pageData.data?.csrfToken;

	// Only add CSRF token for state-changing methods
	if (csrfToken && options?.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method)) {
		options.headers = {
			...options.headers,
			'x-csrf-token': csrfToken,
		};
	}

	return fetch(url, options);
}
