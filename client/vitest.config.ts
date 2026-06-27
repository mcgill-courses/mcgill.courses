import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*'],
      exclude: ['**/*.config.*', '**/*.test.{ts,tsx}'],
    },
    css: true,
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '**/*.browser.test.{ts,tsx}'],
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['vitest.setup.ts'],
  },
});
