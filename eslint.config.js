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

      // Отступы
      indent: ['error', 2],

      // Кавычки для свойств объектов — только когда нужны
      'quote-props': ['error', 'as-needed'],

      // Кавычки для строк
      quotes: ['error', 'single'],

      // Точки с запятой — не используем
      semi: ['error', 'never'],
      'no-extra-semi': 'error',

      // Стрелочные функции — всегда со скобками
      'arrow-parens': ['error', 'always'],

      // Фигурные скобки
      'brace-style': ['error', 'stroustrup'],

      // Запятые в конце
      'comma-dangle': ['error', 'always-multiline'],
    },
  },
]
