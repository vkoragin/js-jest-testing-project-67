import os from "os";
import path from "path";
import fs from "fs/promises";
import nock from "nock";
import pageLoader from "../src/index.js";

nock.disableNetConnect();

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-loader-"));
});

test("downloads and saves page", async () => {
  const url = "https://ru.hexlet.io/courses";
  const html = "<html><body>Hexlet</body></html>";

  nock("https://ru.hexlet.io").get("/courses").reply(200, html);

  const { filepath } = await pageLoader(url, tmpDir);

  const saved = await fs.readFile(filepath, "utf-8");

  expect(saved).toBe(html);
  expect(filepath).toMatch(/ru-hexlet-io-courses\.html$/);
});

test("throws on network error", async () => {
  const url = "https://ru.hexlet.io/unknown";

  nock("https://ru.hexlet.io").get("/unknown").reply(404);

  await expect(pageLoader(url, tmpDir)).rejects.toThrow();
});
