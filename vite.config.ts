import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: env.VITE_BASE_PATH ?? '/',
    plugins: [react()],
    assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.bin', '**/*.ktx2'],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/tests/setup.ts'
    }
  };
});
