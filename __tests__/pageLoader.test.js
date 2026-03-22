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
import axios from "axios";
import pageLoader from "../index.js";

// Принудительно устанавливаем адаптер для axios в ES-модулях
// Это критически важно для работы nock в CI
import httpAdapter from "axios/lib/adapters/http.js";
axios.defaults.adapter = httpAdapter;

// Блокируем все реальные сетевые соединения
nock.disableNetConnect();

describe("pageLoader", () => {
  let tmpDir;
  const pageUrl = "https://ru.hexlet.io/courses";
  const pageName = "ru-hexlet-io-courses";

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

  test("downloads page and saves HTML", async () => {
    const html = "<html><body>Test page</body></html>";

    const scope = nock("https://ru.hexlet.io").get("/courses").reply(200, html);

    const { filepath } = await pageLoader(pageUrl, tmpDir);

    expect(filepath).toBe(path.join(tmpDir, `${pageName}.html`));
    const savedHtml = await fs.readFile(filepath, "utf-8");
    expect(savedHtml).toBe(html);
    expect(scope.isDone()).toBe(true);
  });

  test("downloads local resources and updates paths", async () => {
    const html = `
      <html>
        <img src="/assets/logo.png">
        <link rel="stylesheet" href="/styles/main.css">
      </html>
    `;

    const pageScope = nock("https://ru.hexlet.io")
      .get("/courses")
      .reply(200, html);

    const imgScope = nock("https://ru.hexlet.io")
      .get("/assets/logo.png")
      .reply(200, "image data");

    const cssScope = nock("https://ru.hexlet.io")
      .get("/styles/main.css")
      .reply(200, "body { color: red; }");

    await pageLoader(pageUrl, tmpDir);

    expect(pageScope.isDone()).toBe(true);
    expect(imgScope.isDone()).toBe(true);
    expect(cssScope.isDone()).toBe(true);

    const resourcesDir = path.join(tmpDir, `${pageName}_files`);
    const files = await fs.readdir(resourcesDir);
    expect(files.length).toBe(2);

    const updatedHtml = await fs.readFile(
      path.join(tmpDir, `${pageName}.html`),
      "utf-8",
    );
    expect(updatedHtml).toContain(
      `${pageName}_files/ru-hexlet-io-assets-logo.png`,
    );
    expect(updatedHtml).toContain(
      `${pageName}_files/ru-hexlet-io-styles-main.css`,
    );
  });

  test("does not download external resources", async () => {
    const html = `
      <html>
        <body>
          <img src="https://external.com/image.png">
        </body>
      </html>
    `;

    const scope = nock("https://ru.hexlet.io").get("/courses").reply(200, html);

    await pageLoader(pageUrl, tmpDir);

    expect(scope.isDone()).toBe(true);

    const resourcesDir = path.join(tmpDir, `${pageName}_files`);
    try {
      const files = await fs.readdir(resourcesDir);
      expect(files.length).toBe(0);
    } catch (err) {
      expect(err.code).toBe("ENOENT");
    }
  });

  test("throws error on non‑200 status", async () => {
    const scope = nock("https://ru.hexlet.io").get("/courses").reply(404);

    await expect(pageLoader(pageUrl, tmpDir)).rejects.toThrow(
      `Failed to load page ${pageUrl}: status 404`,
    );
    expect(scope.isDone()).toBe(true);
  });

  test("skips broken resources", async () => {
    const html = `
      <html>
        <img src="/ok.png">
        <img src="/fail.png">
      </html>
    `;

    const pageScope = nock("https://ru.hexlet.io")
      .get("/courses")
      .reply(200, html);

    const okScope = nock("https://ru.hexlet.io")
      .get("/ok.png")
      .reply(200, "ok");

    const failScope = nock("https://ru.hexlet.io").get("/fail.png").reply(404);

    await pageLoader(pageUrl, tmpDir);

    expect(pageScope.isDone()).toBe(true);
    expect(okScope.isDone()).toBe(true);
    expect(failScope.isDone()).toBe(true);

    const resourcesDir = path.join(tmpDir, `${pageName}_files`);
    const files = await fs.readdir(resourcesDir);
    expect(files.length).toBe(1);
    expect(files[0]).toContain("ok.png");
  });

  test("handles invalid URLs in resources", async () => {
    const html = `
      <html>
        <img src="http://invalid-url">
        <script src="ftp://invalid"></script>
        <link rel="stylesheet" href="javascript:alert('xss')">
      </html>
    `;

    const scope = nock("https://ru.hexlet.io").get("/courses").reply(200, html);

    const { filepath } = await pageLoader(pageUrl, tmpDir);

    expect(scope.isDone()).toBe(true);

    const savedHtml = await fs.readFile(filepath, "utf-8");
    expect(savedHtml).toContain("http://invalid-url");
    expect(savedHtml).toContain("ftp://invalid");
    expect(savedHtml).toContain("javascript:alert('xss')");
  });
});
