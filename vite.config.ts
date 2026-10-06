import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // Capacitor serves the build from the app bundle, so asset paths must be relative
  // Separate dep caches let several dev servers run side by side (PP_VITE_CACHE=node_modules/.vite-x).
  cacheDir: process.env.PP_VITE_CACHE ?? 'node_modules/.vite',
  build: { target: 'es2020', outDir: 'dist', chunkSizeWarningLimit: 1200 }, // three.js ships inside the app, not over the network
  test: { include: ['test/**/*.test.ts'], testTimeout: 60_000 },
});
