import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { URL } from "url";
import { load } from "cheerio";
import crypto from "crypto";
import debug from "debug";

// Создаем логгеры для разных неймспейсов
const log = debug("page-loader");
const logError = debug("page-loader:error");
const logNetwork = debug("page-loader:network");
const logFile = debug("page-loader:file");

// Включаем логирование для axios и nock через переменные окружения
// Это делается через установку переменной DEBUG в терминале

const MAX_FILENAME_LENGTH = 200;

const sanitizeFilename = (filename) => {
  const sanitized = filename
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  log(`Sanitized filename: ${filename} -> ${sanitized}`);
  return sanitized;
};

const generateFileName = (url) => {
  log(`Generating filename for URL: ${url}`);

  const urlObj = new URL(url);
  const ext = path.extname(urlObj.pathname) || ".html";

  const pathWithoutExt = urlObj.pathname.replace(/\.[^/.]+$/, "");
  const pathParts = pathWithoutExt.split("/").filter((p) => p.length > 0);
  const relevantParts = pathParts.slice(-3);

  const hostPart = urlObj.hostname.replace(/\./g, "-");
  const pathPart = relevantParts.join("-");

  let filename = `${hostPart}${pathPart ? "-" + pathPart : ""}${ext}`;

  if (filename.length > MAX_FILENAME_LENGTH) {
    log(`Filename too long (${filename.length}), using hash`);
    const hash = crypto.createHash("md5").update(url).digest("hex").slice(0, 8);
    filename = `${hostPart}-${hash}${ext}`;
  }

  const finalFilename = sanitizeFilename(filename);
  log(`Generated filename: ${finalFilename}`);
  return finalFilename;
};

const isLocalResource = (resourceUrl, pageUrl) => {
  const resourceHost = new URL(resourceUrl).hostname;
  const pageHost = new URL(pageUrl).hostname;

  const isLocal =
    resourceHost === pageHost ||
    pageHost.endsWith(`.${resourceHost}`) ||
    resourceHost.endsWith(`.${pageHost}`);

  log(
    `Resource ${resourceUrl} is ${isLocal ? "local" : "external"} (host: ${resourceHost}, page host: ${pageHost})`,
  );
  return isLocal;
};

export default async (pageUrl, outputDir = process.cwd()) => {
  log(`Starting page loader for URL: ${pageUrl}`);
  log(`Output directory: ${outputDir}`);

  try {
    logNetwork(`Fetching page: ${pageUrl}`);
    const { data: html } = await axios.get(pageUrl);
    logNetwork(`Page fetched successfully, size: ${html.length} bytes`);

    const pageName = pageUrl
      .replace(/^https?:\/\//, "")
      .replace(/[^a-zA-Z0-9]/g, "-");
    const htmlFilename = `${pageName}.html`;
    const resourcesDirName = `${pageName}_files`;

    const htmlPath = path.join(outputDir, htmlFilename);
    const resourcesDirPath = path.join(outputDir, resourcesDirName);

    logFile(`Creating resources directory: ${resourcesDirPath}`);
    await fs.mkdir(resourcesDirPath, { recursive: true });

    const $ = load(html);
    log(`HTML parsed with cheerio`);

    // Собираем все элементы с ресурсами
    const resourceElements = [
      ...$("img")
        .toArray()
        .map((el) => ({ el, attr: "src", type: "img" })),
      ...$("link[rel='stylesheet']")
        .toArray()
        .map((el) => ({ el, attr: "href", type: "link" })),
      ...$("link[rel='canonical']")
        .toArray()
        .map((el) => ({ el, attr: "href", type: "link" })),
      ...$("script[src]")
        .toArray()
        .map((el) => ({ el, attr: "src", type: "script" })),
    ];

    log(`Found ${resourceElements.length} resource elements`);

    const downloadPromises = resourceElements.map(
      async ({ el, attr, type }) => {
        try {
          const src = $(el).attr(attr);
          if (!src) {
            log(`Element ${type} has no ${attr} attribute`);
            return;
          }

          log(`Processing ${type} with ${attr}: ${src}`);

          let resourceUrl;
          try {
            resourceUrl = new URL(src, pageUrl).href;
            log(`Resolved URL: ${resourceUrl}`);
          } catch {
            logError(`Invalid URL: ${src}`);
            return;
          }

          if (!isLocalResource(resourceUrl, pageUrl)) {
            log(`Skipping external resource: ${resourceUrl}`);
            return;
          }

          const filename = generateFileName(resourceUrl);
          const filePath = path.join(resourcesDirPath, filename);

          try {
            logNetwork(`Downloading resource: ${resourceUrl}`);
            const { data } = await axios.get(resourceUrl, {
              responseType: "arraybuffer",
              timeout: 10000,
            });
            logNetwork(`Resource downloaded, size: ${data.length} bytes`);

            logFile(`Saving resource to: ${filePath}`);
            await fs.writeFile(filePath, data);
            logFile(`Resource saved successfully`);

            const newAttr = `${resourcesDirName}/${filename}`;
            $(el).attr(attr, newAttr);
            log(`Updated ${type} attribute to: ${newAttr}`);
          } catch (downloadError) {
            logError(
              `Failed to download ${resourceUrl}: ${downloadError.message}`,
            );
          }
        } catch (err) {
          logError(`Failed to process element: ${err.message}`);
        }
      },
    );

    log(`Waiting for all resources to download...`);
    await Promise.all(downloadPromises);
    log(`All resources processed`);

    logFile(`Saving HTML to: ${htmlPath}`);
    await fs.writeFile(htmlPath, $.html(), "utf-8");
    logFile(`HTML saved successfully`);

    log(`Page loader completed successfully`);
    return { filepath: htmlPath };
  } catch (error) {
    logError(`Fatal error: ${error.message}`);
    throw error;
  }
};
