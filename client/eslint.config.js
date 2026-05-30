import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
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
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'error',
    },
  },
  {
    ignores: [
      '**/*.spec.*',
      '**/*.test.*',
      '**/.venv/**',
      'coverage/*',
      'cypress.config.js',
      'cypress/*',
      'eslint.config.js',
      'dist/*',
      'vite.config.ts',
      'vitest.config.ts',
      'vitest.setup.ts',
    ],
  },
];
