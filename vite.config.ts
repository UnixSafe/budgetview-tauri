import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			// @ts-expect-error Vitest accepts `all`; the published CoverageOptions type is narrower here.
			all: true,
			include: ['src/lib/utils/**/*.ts', 'src/lib/stores/**/*.ts', 'src/lib/stores/**/*.svelte.ts'],
			exclude: ['src/**/*.test.ts', 'src/lib/types/**', 'src/lib/stores/db.ts'],
			thresholds: {
				lines: 100,
				functions: 100,
				branches: 100,
				statements: 100
			}
		}
	},
	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 1421
				}
			: undefined
	}
});
