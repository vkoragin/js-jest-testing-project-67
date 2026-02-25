import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { URL } from "url";

const normalizeFilename = (url) => {
  const { host, pathname } = new URL(url);
  const full = `${host}${pathname}`;
  const name = full
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${name}.html`;
};

export default async (url, outputDir = process.cwd()) => {
  const response = await axios.get(url);
  const filename = normalizeFilename(url);
  const filepath = path.resolve(outputDir, filename);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(filepath, response.data);

  return { filepath };
};
