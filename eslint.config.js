import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
	js.configs.recommended,
	...tseslint.configs.recommended,
	eslintConfigPrettier,
	{
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'module',
			parserOptions: {
				project: './tsconfig.json',
			},
			globals: {
				// Web Worker globals
				self: 'readonly',
				OffscreenCanvas: 'readonly',
				ImageBitmap: 'readonly',
				ImageData: 'readonly',
				// Browser globals
				window: 'readonly',
				document: 'readonly',
				Worker: 'readonly',
				Blob: 'readonly',
				// Node.js globals for build tools
				console: 'readonly',
			},
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'no-console': 'off',
		},
	},
	{
		ignores: ['dist/**', 'node_modules/**', 'vendor/**', 'demo/**', 'rollup.config.mjs'],
	}
);
