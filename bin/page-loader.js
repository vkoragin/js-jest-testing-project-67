#!/usr/bin/env node

import pageLoader from "../src/index.js";
import debug from "debug";

const log = debug("page-loader:cli");
const logError = debug("page-loader:error");

const pageUrl = process.argv[2];
const outputDir = process.argv[3] || process.cwd();

if (!pageUrl) {
  console.error("Usage: page-loader <url> [output-dir]");
  process.exit(1);
}

log(`Starting page-loader CLI`);
log(`URL: ${pageUrl}`);
log(`Output directory: ${outputDir}`);

console.log(`Loading page: ${pageUrl}`);
console.log(`Output directory: ${outputDir}`);

pageLoader(pageUrl, outputDir)
  .then(({ filepath }) => {
    console.log(`Page successfully loaded to: ${filepath}`);
    log(`CLI completed successfully`);
  })
  .catch((error) => {
    console.error("Error loading page:", error.message);
    logError(`CLI failed: ${error.message}`);
    process.exit(1);
  });
