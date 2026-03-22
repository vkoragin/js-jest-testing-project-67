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

      // Правила для кавычек
      quotes: ['error', 'single'], // одинарные кавычки
      'quote-props': ['error', 'as-needed'], // кавычки для свойств объектов только когда нужно

      // Правила для точек с запятой
      semi: ['error', 'never'], // без точек с запятой
      'no-extra-semi': 'error', // лишние точки с запятой

      // Правила для стрелочных функций - отключаем требование скобок
      'arrow-parens': ['error', 'as-needed'], // скобки только когда нужны (1 аргумент - без скобок)

      // Правила для фигурных скобок
      'brace-style': ['error', 'stroustrup'], // стиль фигурных скобок (else на новой строке)

      // Запятые в конце
      'comma-dangle': ['error', 'always-multiline'], // запятая в конце строк в многострочных объектах
    },
  },
]
