import js from '@eslint/js';

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
      // Правила стиля
      quotes: ['error', 'single'], // одинарные кавычки
      semi: ['error', 'always'], // точка с запятой в конце
      'comma-dangle': ['error', 'always-multiline'], // запятая в конце строк в многострочных объектах
      'arrow-parens': ['error', 'always'], // скобки у стрелочных функций
      'brace-style': ['error', '1tbs'], // стиль фигурных скобок
      'no-extra-semi': 'error', // лишние точки с запятой
    },
  },
];
