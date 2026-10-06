import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // Capacitor serves the build from the app bundle, so asset paths must be relative
  build: { target: 'es2020', outDir: 'dist', chunkSizeWarningLimit: 1200 }, // three.js ships inside the app, not over the network
  test: { include: ['test/**/*.test.ts'], testTimeout: 60_000 },
});
