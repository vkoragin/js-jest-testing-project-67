import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from "@jest/globals";
import os from "os";
import path from "path";
import fs from "fs/promises";
import nock from "nock";
import pageLoader from "../index.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getFixturePath = (name) =>
  path.join(__dirname, "..", "__fixtures__", name);

nock.disableNetConnect();

describe("pageLoader", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-loader-"));
  });

  afterEach(async () => {
    nock.cleanAll();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  test("downloads HTML and resources", async () => {
    const pageUrl = "https://ru.hexlet.io/courses";

    const html = await fs.readFile(getFixturePath("courses.html"), "utf-8");

    nock("https://ru.hexlet.io").get("/courses").reply(200, html);

    nock("https://ru.hexlet.io")
      .get("/assets/application.css")
      .reply(200, "body { color: red; }");

    nock("https://ru.hexlet.io")
      .get("/packs/js/runtime.js")
      .reply(200, 'console.log("runtime");');

    const img = await fs.readFile(getFixturePath("nodejs.png"));
    nock("https://ru.hexlet.io")
      .get("/assets/professions/nodejs.png")
      .reply(200, img);

    const { filepath } = await pageLoader(pageUrl, tmpDir);

    const savedHtml = await fs.readFile(filepath, "utf-8");

    expect(savedHtml).toContain("_files/");

    const resourcesDir = path.join(tmpDir, "ru-hexlet-io-courses_files");
    const files = await fs.readdir(resourcesDir);

    expect(files.length).toBe(3);
  });

  test("throws on 404 page", async () => {
    const pageUrl = "https://ru.hexlet.io/courses";

    nock("https://ru.hexlet.io").get("/courses").reply(404);

    await expect(pageLoader(pageUrl, tmpDir)).rejects.toThrow(/status 404/);
  });

  test("skips broken resources", async () => {
    const pageUrl = "https://ru.hexlet.io/courses";

    const html = `
      <html>
        <img src="/ok.png">
        <img src="/fail.png">
      </html>
    `;

    nock("https://ru.hexlet.io").get("/courses").reply(200, html);

    nock("https://ru.hexlet.io").get("/ok.png").reply(200, "ok");

    nock("https://ru.hexlet.io").get("/fail.png").reply(404);

    await pageLoader(pageUrl, tmpDir);

    const resourcesDir = path.join(tmpDir, "ru-hexlet-io-courses_files");
    const files = await fs.readdir(resourcesDir);

    expect(files.length).toBe(1);
  });

  test("handles invalid urls", async () => {
    const pageUrl = "https://ru.hexlet.io/courses";

    const html = `
      <html>
        <img src="http://invalid-url.com">
        <script src="ftp://invalid"></script>
      </html>
    `;

    nock("https://ru.hexlet.io").get("/courses").reply(200, html);

    const { filepath } = await pageLoader(pageUrl, tmpDir);

    const savedHtml = await fs.readFile(filepath, "utf-8");

    expect(savedHtml).toContain("http://invalid-url.com");
    expect(savedHtml).toContain("ftp://invalid");
  });
});
