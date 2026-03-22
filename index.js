import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { load } from "cheerio";
import { URL } from "url";

const getPageName = (url) =>
  url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "-");

const getFileName = (url) => {
  const { pathname, hostname } = new URL(url);

  const ext = path.extname(pathname);

  const name = `${hostname}${pathname}`
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9]/g, "-");

  if (!ext) {
    return `${name}.html`; // это ресурс, не страница
  }

  return `${name}${ext}`;
};

const isLocal = (resourceUrl, pageUrl) => {
  try {
    return new URL(resourceUrl, pageUrl).hostname === new URL(pageUrl).hostname;
  } catch {
    return false;
  }
};

export default async (pageUrl, outputDir = process.cwd()) => {
  let response;

  try {
    response = await axios.get(pageUrl, { validateStatus: null });
  } catch (e) {
    throw new Error(`Failed to load page ${pageUrl}: Network error`);
  }

  if (response.status !== 200) {
    throw new Error(
      `Failed to load page ${pageUrl}: status ${response.status}`,
    );
  }

  const html = response.data;

  const pageName = getPageName(pageUrl);
  const htmlPath = path.join(outputDir, `${pageName}.html`);
  const resourcesDir = path.join(outputDir, `${pageName}_files`);

  await fs.mkdir(resourcesDir, { recursive: true });

  const $ = load(html);

  const resources = [
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
  ];

  await Promise.all(
    resources.map(async ({ el, attr }) => {
      const src = $(el).attr(attr);
      if (!src) return;

      let resourceUrl;
      try {
        resourceUrl = new URL(src, pageUrl).href;
      } catch {
        return;
      }

      if (!isLocal(resourceUrl, pageUrl)) return;

      const filename = getFileName(resourceUrl);
      const filepath = path.join(resourcesDir, filename);

      try {
        const res = await axios.get(resourceUrl, {
          responseType: "arraybuffer",
          validateStatus: null,
        });

        if (res.status !== 200) return;

        await fs.writeFile(filepath, res.data);
        $(el).attr(attr, `${pageName}_files/${filename}`);
      } catch {
        // игнорируем ошибки ресурсов
      }
    }),
  );

  await fs.writeFile(htmlPath, $.html(), "utf-8");

  return { filepath: htmlPath };
};
