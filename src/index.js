import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { URL } from "url";
import { load } from "cheerio";
import crypto from "crypto";

// Максимальная длина имени файла для Windows (обычно 255 символов, оставим запас)
const MAX_FILENAME_LENGTH = 200;

const sanitizeFilename = (filename) => {
  // Заменяем недопустимые символы для Windows
  return filename
    .replace(/[<>:"/\\|?*]/g, "-") // Недопустимые символы в Windows
    .replace(/\s+/g, "-") // Пробелы на дефисы
    .replace(/-+/g, "-") // Множественные дефисы на один
    .replace(/^[.-]+|[.-]+$/g, ""); // Удаляем дефисы и точки в начале и конце
};

const generateFileName = (url) => {
  const urlObj = new URL(url);
  const ext = path.extname(urlObj.pathname) || ".html";

  // Получаем путь без расширения
  const pathWithoutExt = urlObj.pathname.replace(/\.[^/.]+$/, "");

  // Разбиваем путь на части и берем последние значимые части
  const pathParts = pathWithoutExt.split("/").filter((p) => p.length > 0);

  // Берем последние 3 части пути или меньше, если путь короче
  const relevantParts = pathParts.slice(-3);

  // Создаем имя из хоста и значимых частей пути
  const hostPart = urlObj.hostname.replace(/\./g, "-");
  const pathPart = relevantParts.join("-");

  let filename = `${hostPart}${pathPart ? "-" + pathPart : ""}${ext}`;

  // Если имя слишком длинное, используем хеш
  if (filename.length > MAX_FILENAME_LENGTH) {
    const hash = crypto.createHash("md5").update(url).digest("hex").slice(0, 8);
    filename = `${hostPart}-${hash}${ext}`;
  }

  return sanitizeFilename(filename);
};

const isLocalResource = (resourceUrl, pageUrl) => {
  const resourceHost = new URL(resourceUrl).hostname;
  const pageHost = new URL(pageUrl).hostname;

  // Ресурс считается локальным, если:
  // 1. Это тот же хост
  // 2. Это поддомен того же домена (ru.hexlet.io и hexlet.io)
  // 3. Это ресурс без указания хоста (относительный путь)
  return (
    resourceHost === pageHost ||
    pageHost.endsWith(`.${resourceHost}`) ||
    resourceHost.endsWith(`.${pageHost}`)
  );
};

export default async (pageUrl, outputDir = process.cwd()) => {
  const { data: html } = await axios.get(pageUrl);

  const pageName = pageUrl
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "-");
  const htmlFilename = `${pageName}.html`;
  const resourcesDirName = `${pageName}_files`;

  const htmlPath = path.join(outputDir, htmlFilename);
  const resourcesDirPath = path.join(outputDir, resourcesDirName);

  await fs.mkdir(resourcesDirPath, { recursive: true });

  const $ = load(html);

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

  const downloadPromises = resourceElements.map(async ({ el, attr }) => {
    try {
      const src = $(el).attr(attr);
      if (!src) return;

      let resourceUrl;
      try {
        resourceUrl = new URL(src, pageUrl).href;
      } catch {
        console.warn(`Bad ${attr}: ${src}`);
        return;
      }

      // Пропускаем внешние ресурсы (другие домены)
      if (!isLocalResource(resourceUrl, pageUrl)) {
        console.log(`Skipping external resource: ${resourceUrl}`);
        return;
      }

      const filename = generateFileName(resourceUrl);
      const filePath = path.join(resourcesDirPath, filename);

      try {
        // Скачиваем ресурс
        const { data } = await axios.get(resourceUrl, {
          responseType: "arraybuffer",
          timeout: 10000, // Добавляем таймаут
        });
        await fs.writeFile(filePath, data);

        // Обновляем ссылку в HTML
        $(el).attr(attr, `${resourcesDirName}/${filename}`);

        console.log(`Downloaded: ${resourceUrl} -> ${filename}`);
      } catch (downloadError) {
        console.warn(
          `Failed to download ${resourceUrl}: ${downloadError.message}`,
        );
        // Не обновляем ссылку в HTML при ошибке скачивания
      }
    } catch (err) {
      console.warn(`Failed to process ${$(el).attr(attr)}: ${err.message}`);
    }
  });

  await Promise.all(downloadPromises);

  await fs.writeFile(htmlPath, $.html(), "utf-8");

  return { filepath: htmlPath };
};
