import os from "os";
import path from "path";
import fs from "fs/promises";
import nock from "nock";
import pageLoader from "../src/index.js";

const projectRoot = path.resolve();
const getFixturePath = (name) => path.join(projectRoot, "__fixtures__", name);

nock.disableNetConnect();

describe("pageLoader", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-loader-"));
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test("downloads HTML and resources, rewrites resource paths", async () => {
    const pageUrl = "https://ru.hexlet.io/courses";

    // Мокаем HTML из фикстуры
    const htmlFixture = await fs.readFile(
      getFixturePath("courses.html"),
      "utf-8",
    );
    nock("https://ru.hexlet.io").get("/courses").reply(200, htmlFixture);

    // Мокаем ресурсы
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

    nock("https://ru.hexlet.io")
      .get("/courses")
      .reply(200, "<html><body>Courses page</body></html>");

    // Внешние ресурсы
    nock("https://cdn2.hexlet.io")
      .get("/assets/menu.css")
      .reply(200, "external css");

    nock("https://js.stripe.com").get("/v3/").reply(200, "stripe js");

    // Запускаем pageLoader
    const { filepath } = await pageLoader(pageUrl, tmpDir);

    // 1. Проверяем изменение HTML
    const savedHtml = await fs.readFile(filepath, "utf-8");

    // Локальные ресурсы должны указывать на файлы в директории
    expect(savedHtml).toContain("ru-hexlet-io-courses_files/");
    expect(savedHtml).not.toContain("/assets/application.css");
    expect(savedHtml).not.toContain("/assets/professions/nodejs.png");
    expect(savedHtml).not.toContain("/packs/js/runtime.js");
    expect(savedHtml).not.toContain("/courses");

    // Внешние ресурсы должны остаться без изменений
    expect(savedHtml).toContain("https://cdn2.hexlet.io/assets/menu.css");
    expect(savedHtml).toContain("https://js.stripe.com/v3/");

    // 2. Проверяем скачивание ресурсов
    const resourcesDir = path.join(tmpDir, "ru-hexlet-io-courses_files");
    const files = await fs.readdir(resourcesDir);

    // Проверяем, что скачались все 4 ресурса
    expect(files.length).toBe(4);

    // Проверяем, что файлы существуют и не пустые
    for (const file of files) {
      const filePath = path.join(resourcesDir, file);
      const stat = await fs.stat(filePath);
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBeGreaterThan(0);
    }
  });
});
