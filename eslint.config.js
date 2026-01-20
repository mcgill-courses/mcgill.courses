import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'error',
    },
  },
  {
    ignores: [
      'client/dist/*',
      'client/coverage/*',
      'cypress.config.js',
      'cypress/*',
      'vite.config.ts',
      'vitest.config.ts',
      'vitest.setup.ts',
      '**/*.test.*',
      '**/*.spec.*',
      'coverage/*',
      'eslint.config.js',
      'tools/*',
      '**/.venv/**',
    ],
  }
);
