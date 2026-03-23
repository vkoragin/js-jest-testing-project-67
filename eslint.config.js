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

      // Стрелочные функции — ВСЕГДА со скобками вокруг аргументов
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
