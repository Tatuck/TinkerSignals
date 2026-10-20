/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      output: {
        // React y React Flow cambian poco: en su propio archivo se quedan en caché.
        manualChunks: (id) => (id.includes('node_modules') ? 'vendor' : undefined),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Los bloques se autodescubren con import.meta.glob; la caché en disco de
    // Vitest no se entera de carpetas nuevas, así que se desactiva.
    fsModuleCache: false,
  },
});
