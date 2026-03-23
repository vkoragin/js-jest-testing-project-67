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

      // Отступы — 2 пробела
      indent: ['error', 2],

      // Кавычки для строк — одинарные
      quotes: ['error', 'single'],

      // Точки с запятой — не используем
      semi: ['error', 'never'],
      'no-extra-semi': 'error',

      // Стрелочные функции — ВСЕГДА с фигурными скобками и return
      'arrow-body-style': ['error', 'always'],

      // Стрелочные функции — всегда со скобками вокруг аргументов
      'arrow-parens': ['error', 'always'],

      // Фигурные скобки — стиль Stroustrup
      'brace-style': ['error', 'stroustrup'],

      // Запятые в конце — только для многострочных конструкций
      'comma-dangle': ['error', 'always-multiline'],

      // Кавычки для свойств объектов — только когда нужны
      'quote-props': ['error', 'as-needed'],
    },
  },
]
