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
    nock.enableNetConnect(); // Восстановить возможность сетевых соединений после тестов
  });

  test("downloads page and saves HTML", async () => {
    const html = "<html><body>Test page</body></html>";

    nock("https://ru.hexlet.io").get("/courses").reply(200, html);

    const { filepath } = await pageLoader(pageUrl, tmpDir);

    expect(filepath).toBe(path.join(tmpDir, `${pageName}.html`));
    const savedHtml = await fs.readFile(filepath, "utf-8");
    expect(savedHtml).toContain("Test page");
  });

  test("downloads local resources and updates paths", async () => {
    const html = `
      <html>
        <body>
          <img src="/assets/logo.png" alt="Logo">
          <link rel="stylesheet" href="/styles/main.css">
        </body>
      </html>
    `;

    // Мокаем основной запрос
    nock("https://ru.hexlet.io")
      .get("/courses")
      .reply(200, html)
      // Мокаем ресурсы внутри страницы
      .get("/assets/logo.png")
      .reply(200, "image data")
      .get("/styles/main.css")
      .reply(200, "body { color: red; }");

    await pageLoader(pageUrl, tmpDir);

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

    // Мокаем только основной запрос
    nock("https://ru.hexlet.io").get("/courses").reply(200, html);

    await pageLoader(pageUrl, tmpDir);

    const resourcesDir = path.join(tmpDir, `${pageName}_files`);
    const files = await fs.readdir(resourcesDir);
    expect(files.length).toBe(0);
  });

  test("throws error on non‑200 status", async () => {
    nock("https://ru.hexlet.io").get("/courses").reply(404);

    await expect(pageLoader(pageUrl, tmpDir)).rejects.toThrow(
      `Failed to load page ${pageUrl}: status 404`,
    );
  });
});
