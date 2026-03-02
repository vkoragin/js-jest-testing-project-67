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
  const pathParts = urlObj.pathname
    .replace(/\.[^/.]+$/, "")
    .split("/")
    .filter(Boolean);
  const relevantParts = pathParts.slice(-3);
  const hostPart = urlObj.hostname.replace(/\./g, "-");
  const pathPart = relevantParts.join("-");
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
    return (
      resourceHost === pageHost ||
      pageHost.endsWith(`.${resourceHost}`) ||
      resourceHost.endsWith(`.${pageHost}`)
    );
  } catch {
    return false;
  }
};

export default async (pageUrl, outputDir = process.cwd()) => {
  let html;
  try {
    const response = await axios.get(pageUrl);
    html = response.data;
  } catch (error) {
    if (error.response) {
      const customError = new Error(
        `Failed to load page ${pageUrl}: Server responded with status ${error.response.status}`,
      );
      customError.cause = error;
      throw customError;
    }
    if (error.request) {
      const customError = new Error(
        `Failed to load page ${pageUrl}: Network error`,
      );
      customError.cause = error;
      throw customError;
    }
    const customError = new Error(
      `Failed to load page ${pageUrl}: ${error.message}`,
    );
    customError.cause = error;
    throw customError;
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
    ...$("link[rel='stylesheet']")
      .toArray()
      .map((el) => ({ el, attr: "href" })),
    ...$("link[rel='canonical']")
      .toArray()
      .map((el) => ({ el, attr: "href" })),
    ...$("script[src]")
      .toArray()
      .map((el) => ({ el, attr: "src" })),
  ];

  await Promise.all(
    resourceElements.map(async ({ el, attr }) => {
      const src = $(el).attr(attr);
      if (!src) return;

      let resourceUrl;
      try {
        resourceUrl = new URL(src, pageUrl).href;
      } catch {
        return; // invalid URL, leave HTML unchanged
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
        // failed resource → ignore, leave HTML unchanged
      }
    }),
  );

  await fs.writeFile(htmlPath, $.html(), "utf-8");
  return { filepath: htmlPath };
};
