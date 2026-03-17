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
import axios from "axios";

axios.defaults.adapter = "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getFixturePath = (name) =>
  path.join(__dirname, "..", "__fixtures__", name);

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

  test("downloads HTML and resources, rewrites resource paths", async () => {
    const pageUrl = "https://ru.hexlet.io/courses";

    const htmlFixture = await fs.readFile(
      getFixturePath("courses.html"),
      "utf-8",
    );

    nock("https://ru.hexlet.io")
      .get("/courses")
      .times(2)
      .reply(200, htmlFixture);

    nock("https://ru.hexlet.io")
      .get("/assets/application.css")
      .reply(200, "body { color: red; }");

    nock("https://ru.hexlet.io")
      .get("/packs/js/runtime.js")
      .reply(200, 'console.log("runtime");');

    const imgData = await fs.readFile(getFixturePath("nodejs.png"));
    nock("https://ru.hexlet.io")
      .get("/assets/professions/nodejs.png")
      .reply(200, imgData);

    nock("https://cdn2.hexlet.io")
      .get("/assets/menu.css")
      .reply(200, "external css");

    nock("https://js.stripe.com").get("/v3/").reply(200, "stripe js");

    const { filepath } = await pageLoader(pageUrl, tmpDir);

    const savedHtml = await fs.readFile(filepath, "utf-8");

    expect(savedHtml).toContain("ru-hexlet-io-courses_files/");
    expect(savedHtml).not.toContain("/assets/application.css");
    expect(savedHtml).not.toContain("/assets/professions/nodejs.png");
    expect(savedHtml).not.toContain("/packs/js/runtime.js");

    expect(savedHtml).toContain("https://cdn2.hexlet.io/assets/menu.css");
    expect(savedHtml).toContain("https://js.stripe.com/v3/");

    const resourcesDir = path.join(tmpDir, "ru-hexlet-io-courses_files");
    const files = await fs.readdir(resourcesDir);

    expect(files.length).toBe(4);
  });

  test("throws an error when the server responds with 404 for the main page", async () => {
    const pageUrl = "https://ru.hexlet.io/courses";

    nock("https://ru.hexlet.io").get("/courses").reply(404, "Not Found");

    await expect(pageLoader(pageUrl, tmpDir)).rejects.toThrow(/status 404/);
  });

  test("continues loading when resources fail with 404", async () => {
    const pageUrl = "https://ru.hexlet.io/courses";

    const htmlWithResource = `
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="stylesheet" href="/assets/style.css">
          <link rel="stylesheet" href="/assets/broken.css">
        </head>
        <body>
          <img src="/assets/image.png" />
          <img src="/assets/broken.png" />
          <script src="/js/script.js"></script>
          <script src="/js/broken.js"></script>
        </body>
      </html>
    `;

    nock("https://ru.hexlet.io").get("/courses").reply(200, htmlWithResource);

    nock("https://ru.hexlet.io")
      .get("/assets/style.css")
      .reply(200, "body { color: red; }");

    nock("https://ru.hexlet.io")
      .get("/js/script.js")
      .reply(200, 'console.log("ok");');

    nock("https://ru.hexlet.io")
      .get("/assets/image.png")
      .reply(200, "fake image content");

    nock("https://ru.hexlet.io")
      .get("/assets/broken.css")
      .reply(404, "Not Found");

    nock("https://ru.hexlet.io")
      .get("/assets/broken.png")
      .reply(500, "Internal Server Error");

    nock("https://ru.hexlet.io")
      .get("/js/broken.js")
      .replyWithError("Connection refused");

    const { filepath } = await pageLoader(pageUrl, tmpDir);

    const savedHtml = await fs.readFile(filepath, "utf-8");

    const resourcesDir = path.join(tmpDir, "ru-hexlet-io-courses_files");
    const files = await fs.readdir(resourcesDir);

    expect(files.length).toBe(3);

    expect(savedHtml).toContain("_files/");
    expect(savedHtml).not.toContain("/assets/style.css");
    expect(savedHtml).not.toContain("/js/script.js");
    expect(savedHtml).not.toContain("/assets/image.png");

    expect(savedHtml).toContain("/assets/broken.css");
    expect(savedHtml).toContain("/assets/broken.png");
    expect(savedHtml).toContain("/js/broken.js");
  });

  test("throws an error when cannot write to output directory", async () => {
    const pageUrl = "https://ru.hexlet.io/simple";

    const filePath = path.join(tmpDir, "test-file");
    await fs.writeFile(filePath, "test");

    nock("https://ru.hexlet.io").get("/simple").reply(200, "<html></html>");

    await expect(pageLoader(pageUrl, filePath)).rejects.toThrow();
  });

  test("handles invalid URLs gracefully", async () => {
    const pageUrl = "https://ru.hexlet.io/courses";

    const htmlWithInvalidUrls = `
      <!DOCTYPE html>
      <html>
        <body>
          <img src="http://invalid-url.com" />
          <script src="ftp://invalid:port"></script>
          <link rel="stylesheet" href="://missing-protocol" />
        </body>
      </html>
    `;

    nock("https://ru.hexlet.io")
      .get("/courses")
      .reply(200, htmlWithInvalidUrls);

    const { filepath } = await pageLoader(pageUrl, tmpDir);

    const savedHtml = await fs.readFile(filepath, "utf-8");
    expect(savedHtml).toContain("http://invalid-url.com");
    expect(savedHtml).toContain("ftp://invalid:port");
    expect(savedHtml).toContain("://missing-protocol");
  });
});
