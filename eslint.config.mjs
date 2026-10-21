import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'data/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['apps/api/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{ts,vue}'],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },
  prettier,
];
