/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    environmentMatchGlobs: [
      ['src/**', 'jsdom'],
      ['scripts/**', 'node'],
    ],
    setupFiles: ['src/tests/setup.ts'],
  },
});
