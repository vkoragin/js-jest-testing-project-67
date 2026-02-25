import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { URL } from "url";
import { load } from "cheerio";
import crypto from "crypto";

const generateFileName = (url) => {
  const ext = path.extname(new URL(url).pathname) || ".png";
  const hash = crypto.createHash("sha1").update(url).digest("hex");
  return `${hash}${ext}`;
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

  const imgElements = $("img").toArray();

  const imgPromises = imgElements.map(async (img) => {
    try {
      const src = $(img).attr("src") || $(img).attr("data-src");
      if (!src) return;

      let resourceUrl;
      try {
        resourceUrl = new URL(src, pageUrl).href;
      } catch {
        console.warn(`Bad src: ${src}`);
        return;
      }

      const filename = generateFileName(resourceUrl);
      const filePath = path.join(resourcesDirPath, filename);

      const { data } = await axios.get(resourceUrl, {
        responseType: "arraybuffer",
      });
      await fs.writeFile(filePath, data);

      $(img).attr("src", `${resourcesDirName}/${filename}`);
    } catch (err) {
      console.warn(`Failed to download ${$(img).attr("src")}: ${err.message}`);
    }
  });

  await Promise.all(imgPromises);

  await fs.writeFile(htmlPath, $.html(), "utf-8");

  return { filepath: htmlPath };
};
