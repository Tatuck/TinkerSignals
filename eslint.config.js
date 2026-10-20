import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // El motor y los bloques no deben depender de la UI.
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/engine/**/*.ts', 'src/blocks/**/*.ts'],
    ignores: ['src/blocks/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['react', 'react-dom', '@xyflow/*', '**/ui/**'], message: 'El motor y los bloques son TS puro: no pueden importar la UI.' }] },
      ],
    },
  },
);
