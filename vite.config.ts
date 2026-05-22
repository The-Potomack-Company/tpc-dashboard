/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Vitest 4 deprecated `environmentMatchGlobs` in favour of `projects`.
    // We split into two projects so src/ tests run under jsdom (RTL) and
    // scripts/ tests run under node (pdf-parse needs Node).
    projects: [
      {
        extends: true,
        test: {
          name: 'src',
          globals: true,
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['src/tests/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'scripts',
          globals: true,
          environment: 'node',
          include: ['scripts/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'api',
          globals: true,
          environment: 'node',
          include: ['api/**/*.test.ts'],
        },
      },
    ],
  },
});
