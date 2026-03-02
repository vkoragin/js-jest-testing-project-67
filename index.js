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
  const urlObj = new URL(url);
  const ext = path.extname(urlObj.pathname) || ".html";

  const pathWithoutExt = urlObj.pathname.replace(/\.[^/.]+$/, "");
  const pathParts = pathWithoutExt.split("/").filter(Boolean);

  const hostPart = urlObj.hostname.replace(/\./g, "-");
  const pathPart = pathParts.join("-");

  let filename = `${hostPart}${pathPart ? "-" + pathPart : ""}${ext}`;

  if (filename.length > MAX_FILENAME_LENGTH) {
    const hash = crypto.createHash("md5").update(url).digest("hex").slice(0, 8);
    filename = `${hostPart}-${hash}${ext}`;
  }

  return sanitizeFilename(filename);
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

  let html;
  try {
    logNetwork(`Fetching page: ${pageUrl}`);
    const response = await axios.get(pageUrl, {
      timeout: 10000,
      validateStatus: function (status) {
        return status >= 200 && status < 300;
      },
    });
    html = response.data;
    logNetwork(`Page fetched successfully, size: ${html.length} bytes`);
  } catch (error) {
    logError(`Error fetching page: ${error.message}`);

    if (error.response) {
      // HTTP ошибка (404, 500 и т.д.)
      const customError = new Error(
        `Failed to load page ${pageUrl}: Server responded with status ${error.response.status}`,
      );
      customError.cause = error;
      throw customError;
    } else if (error.request) {
      // Запрос был сделан, но ответ не получен
      const customError = new Error(
        `Failed to load page ${pageUrl}: No response received. The server might be down.`,
      );
      customError.cause = error;
      throw customError;
    } else if (error.code === "ENOTFOUND") {
      const customError = new Error(
        `Network error: Cannot reach ${pageUrl}. Please check your internet connection.`,
      );
      customError.cause = error;
      throw customError;
    } else if (error.code === "ECONNREFUSED") {
      const customError = new Error(
        `Network error: Connection refused to ${pageUrl}. The server might be down.`,
      );
      customError.cause = error;
      throw customError;
    } else if (error.code === "ECONNABORTED") {
      const customError = new Error(
        `Failed to load page ${pageUrl}: Request timeout. The server is too slow.`,
      );
      customError.cause = error;
      throw customError;
    } else {
      // Другие ошибки
      const customError = new Error(
        `Failed to load page ${pageUrl}: ${error.message}`,
      );
      customError.cause = error;
      throw customError;
    }
  }

  // Генерируем имена файлов
  const pageName = pageUrl
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "-");
  const htmlFilename = `${pageName}.html`;
  const resourcesDirName = `${pageName}_files`;

  const htmlPath = path.join(outputDir, htmlFilename);
  const resourcesDirPath = path.join(outputDir, resourcesDirName);

  // Создаем директорию для ресурсов
  try {
    logFile(`Creating resources directory: ${resourcesDirPath}`);
    await fs.mkdir(resourcesDirPath, { recursive: true });
    logFile(`Resources directory created successfully`);
  } catch (error) {
    logError(`Error creating directory: ${error.message}`);

    let customError;
    if (error.code === "EACCES") {
      customError = new Error(
        `Permission denied: Cannot create directory ${resourcesDirPath}. Please check your permissions.`,
      );
    } else if (error.code === "ENOENT") {
      customError = new Error(
        `Cannot create directory ${resourcesDirPath}: Parent directory does not exist.`,
      );
    } else {
      customError = new Error(
        `Failed to create resources directory: ${error.message}`,
      );
    }
    customError.cause = error;
    throw customError;
  }

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

  const downloadPromises = resourceElements.map(async ({ el, attr, type }) => {
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
        const response = await axios.get(resourceUrl, {
          responseType: "arraybuffer",
          timeout: 10000,
          validateStatus: function (status) {
            return status >= 200 && status < 300;
          },
        });
        logNetwork(`Resource downloaded, size: ${response.data.length} bytes`);

        try {
          logFile(`Saving resource to: ${filePath}`);
          await fs.writeFile(filePath, response.data);
          logFile(`Resource saved successfully`);

          const newAttr = `${resourcesDirName}/${filename}`;
          $(el).attr(attr, newAttr);
          log(`Updated ${type} attribute to: ${newAttr}`);
        } catch (writeError) {
          logError(`Failed to write file ${filePath}: ${writeError.message}`);
          // Не обновляем ссылку при ошибке записи, но продолжаем выполнение
        }
      } catch (downloadError) {
        // Логируем ошибку скачивания, но не прерываем выполнение
        if (downloadError.response) {
          logError(
            `Failed to download ${resourceUrl}: Server responded with status ${downloadError.response.status}`,
          );
        } else if (downloadError.request) {
          logError(`Failed to download ${resourceUrl}: No response received`);
        } else if (downloadError.code === "ECONNABORTED") {
          logError(`Failed to download ${resourceUrl}: Request timeout`);
        } else {
          logError(
            `Failed to download ${resourceUrl}: ${downloadError.message}`,
          );
        }
        // Не обновляем ссылку в HTML при ошибке
      }
    } catch (err) {
      logError(`Failed to process element: ${err.message}`);
    }
  });

  log(`Waiting for all resources to download...`);
  await Promise.all(downloadPromises);
  log(`All resources processed`);

  try {
    logFile(`Saving HTML to: ${htmlPath}`);
    await fs.writeFile(htmlPath, $.html(), "utf-8");
    logFile(`HTML saved successfully`);
  } catch (error) {
    logError(`Error saving HTML: ${error.message}`);

    let customError;
    if (error.code === "EACCES") {
      customError = new Error(
        `Permission denied: Cannot write HTML file ${htmlPath}`,
      );
    } else if (error.code === "ENOSPC") {
      customError = new Error(
        `No space left on device: Cannot write HTML file ${htmlPath}`,
      );
    } else {
      customError = new Error(`Failed to save HTML file: ${error.message}`);
    }
    customError.cause = error;
    throw customError;
  }

  log(`Page loader completed successfully`);
  return { filepath: htmlPath };
};
