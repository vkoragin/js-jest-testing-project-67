import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { load } from "cheerio";
import { URL } from "url";
import crypto from "crypto";
import debugLib from "debug";

const debug = debugLib("page-loader");

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
    const resourceHost = new URL(resourceUrl, pageUrl).hostname;
    const pageHost = new URL(pageUrl).hostname;
    return resourceHost === pageHost;
  } catch {
    return false;
  }
};

export default async (pageUrl, outputDir = process.cwd()) => {
  debug("Start loading page: %s", pageUrl);

  let html;
  try {
    const response = await axios.get(pageUrl, {
      maxRedirects: 0,
      validateStatus: null,
    });
    html = response.data;
    if (response.status !== 200) {
      throw new Error(
        `Failed to load page ${pageUrl}: status ${response.status}`,
      );
    }
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Failed to load page ${pageUrl}: status ${error.response.status}`,
        { cause: error },
      );
    }
    if (error.request) {
      throw new Error(`Failed to load page ${pageUrl}: Network error`, {
        cause: error,
      });
    }
    throw new Error(`Failed to load page ${pageUrl}: ${error.message}`, {
      cause: error,
    });
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
    ...$("link[rel='stylesheet']")
      .toArray()
      .map((el) => ({ el, attr: "href" })),
    ...$("link[rel='canonical']")
      .toArray()
      .map((el) => ({ el, attr: "href" })),
    ...$("link[rel='icon']")
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
        debug("Skipping invalid URL: %s", src);
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
        debug("Downloaded resource: %s", resourceUrl);
      } catch (err) {
        debug("Failed to download resource %s: %s", resourceUrl, err.message);
      }
    }),
  );

  try {
    await fs.writeFile(htmlPath, $.html(), "utf-8");
    debug("Saved HTML to %s", htmlPath);
  } catch (err) {
    throw new Error(`Cannot write HTML file: ${err.message}`, { cause: err });
  }

  return { filepath: htmlPath };
};
