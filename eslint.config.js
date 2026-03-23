import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['eslint.config.js'],
    rules: {
      'quote-props': ['error', 'always'], // всегда с кавычками
      indent: ['error', 2],
      quotes: ['error', 'single'],
      semi: ['error', 'never'],
      'no-extra-semi': 'error',
      'arrow-parens': 'off',
      'brace-style': ['error', 'stroustrup'],
      'comma-dangle': ['error', 'always-multiline'],
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.js', '!eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        test: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        describe: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'quote-props': ['error', 'as-needed'], // кавычки только когда нужны
      indent: ['error', 2],
      quotes: ['error', 'single'],
      semi: ['error', 'never'],
      'no-extra-semi': 'error',
      'arrow-parens': 'off',
      'brace-style': ['error', 'stroustrup'],
      'comma-dangle': ['error', 'always-multiline'],
    },
  },
]
