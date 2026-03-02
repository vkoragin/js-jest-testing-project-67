#!/usr/bin/env node
import pageLoader from "../src/index.js";

const pageUrl = process.argv[2];
const outputDir = process.argv[3] || process.cwd();

if (!pageUrl) {
  console.error("Usage: page-loader <url> [output-dir]");
  process.exit(1); // Код ошибки 1
}

pageLoader(pageUrl, outputDir)
  .then(({ filepath }) => {
    console.log(`Page successfully loaded to: ${filepath}`);
    process.exit(0); // Успешное завершение
  })
  .catch((error) => {
    console.error("Error loading page:", error.message); // Вывод в STDERR
    process.exit(1); // Код ошибки 1
  });
