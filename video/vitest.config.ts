import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Se lanza desde la raíz del repo (`npm run audios`) para usar el motor real.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['video/scripts/**/*.test.ts'],
    fsModuleCache: false,
  },
});
