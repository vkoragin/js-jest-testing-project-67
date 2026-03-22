import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        describe: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',

      // Правила для отступов (используем 2 пробела)
      indent: ['error', 2],

      // Правила для кавычек
      quotes: ['error', 'single'],
      'quote-props': ['error', 'as-needed'],

      // Правила для точек с запятой
      semi: ['error', 'never'],
      'no-extra-semi': 'error',

      // Правила для стрелочных функций
      // Нужны скобки если:
      // - больше одного аргумента
      // - тело функции в фигурных скобках
      'arrow-parens': ['error', 'always'],

      // Правила для фигурных скобок
      'brace-style': ['error', 'stroustrup'],

      // Запятые в конце
      'comma-dangle': ['error', 'always-multiline'],
    },
  },
]
