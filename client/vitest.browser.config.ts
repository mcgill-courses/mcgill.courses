import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    css: true,
    globals: true,
    include: ['src/**/*.browser.test.{ts,tsx}'],
    setupFiles: ['vitest.setup.ts'],
  },
});
