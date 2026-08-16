import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Use the seeded RNG from src/core/rng; Math.random() is forbidden in simulation code.',
        },
      ],
    },
  },
  {
    files: ['src/phaser/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/core/*', '@/core/**', '../core/*', '../../core/*', '../../../core/*'],
              message:
                'Phaser is visualization-only. Feed it flat visualization DTOs through the bridge; do not import the simulation core.',
            },
          ],
        },
      ],
    },
  },
);
