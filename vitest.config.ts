import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte()],
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/lib/test/setup.ts'],
		exclude: ['**/node_modules/**', '**/tests/integration/**'],
	},
	resolve: {
		alias: {
			$lib: '/src/lib',
			$app: '/src/app',
		},
	},
});
