import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@common': fileURLToPath(new URL('../common', import.meta.url)),
      '@config': fileURLToPath(new URL('./config', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@middleware': fileURLToPath(new URL('./src/middleware', import.meta.url)),
      '@models': fileURLToPath(new URL('./src/models', import.meta.url)),
      '@jobs': fileURLToPath(new URL('./src/jobs', import.meta.url)),
      '@repositories': fileURLToPath(new URL('./src/repositories', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@api': fileURLToPath(new URL('./src/api', import.meta.url)),
    },
  },
});
