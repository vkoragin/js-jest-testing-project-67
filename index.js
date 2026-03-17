import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { load } from "cheerio";
import { URL } from "url";
import crypto from "crypto";

const MAX_FILENAME_LENGTH = 200;

const sanitizeFilename = (filename) =>
  filename
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

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
  try {
    const resourceHost = new URL(resourceUrl).hostname;
    const pageHost = new URL(pageUrl).hostname;
    return resourceHost === pageHost;
  } catch {
    return false;
  }
};

export default async (pageUrl, outputDir = process.cwd()) => {
  // ✅ проверка URL
  try {
    new URL(pageUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  let html;

  try {
    const response = await axios.get(pageUrl);
    html = response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Request failed with status ${error.response.status}`, {
        cause: error,
      });
    }

    if (error.request) {
      throw new Error(`Failed to load page ${pageUrl}: Network error`, {
        cause: error,
      });
    }

    throw new Error(error.message, { cause: error });
  }

  const pageName = pageUrl
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "-");

  const htmlFilename = `${pageName}.html`;
  const resourcesDirName = `${pageName}_files`;

  const htmlPath = path.join(outputDir, htmlFilename);
  const resourcesDirPath = path.join(outputDir, resourcesDirName);

  await fs.mkdir(resourcesDirPath, { recursive: true });

  const $ = load(html);

  const resourceElements = [
    ...$("img")
      .toArray()
      .map((el) => ({ el, attr: "src" })),

    ...$("script[src]")
      .toArray()
      .map((el) => ({ el, attr: "src" })),

    ...$("link[href]")
      .toArray()
      .map((el) => ({ el, attr: "href" })),
  ];

  await Promise.all(
    resourceElements.map(async ({ el, attr }) => {
      const src = $(el).attr(attr);
      if (!src) return;

      let resourceUrl;
      try {
        resourceUrl = new URL(src, pageUrl).href;
      } catch {
        return;
      }

      if (!isLocalResource(resourceUrl, pageUrl)) return;

      const filename = generateFileName(resourceUrl);
      const filePath = path.join(resourcesDirPath, filename);

      try {
        const response = await axios.get(resourceUrl, {
          responseType: "arraybuffer",
        });

        await fs.writeFile(filePath, response.data);
        $(el).attr(attr, `${resourcesDirName}/${filename}`);
      } catch {
        // игнорируем ошибки ресурсов (404 и т.д.)
      }
    }),
  );

  await fs.writeFile(htmlPath, $.html(), "utf-8");

  return { filepath: htmlPath };
};
