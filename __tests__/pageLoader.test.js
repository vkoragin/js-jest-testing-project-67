import os from "os";
import path from "path";
import fs from "fs/promises";
import nock from "nock";
import pageLoader from "../src/index.js";

const projectRoot = path.resolve();
const getFixturePath = (name) => path.join(projectRoot, "__fixtures__", name);

nock.disableNetConnect(); // запрещаем реальные HTTP-запросы

describe("pageLoader", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-loader-"));
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test("downloads HTML page only", async () => {
    const pageUrl = "https://ru.hexlet.io/simple";
    const htmlFixture = "<html><body><h1>Simple Page</h1></body></html>";

    // Мокаем HTML
    nock("https://ru.hexlet.io").get("/simple").reply(200, htmlFixture);

    const { filepath } = await pageLoader(pageUrl, tmpDir);

    const savedHtml = await fs.readFile(filepath, "utf-8");
    expect(savedHtml).toContain("Simple Page");
  });

  test("downloads HTML and image, rewrites image src", async () => {
    const pageUrl = "https://ru.hexlet.io/courses";

    // 1. Мокаем HTML из фикстуры
    const htmlFixture = await fs.readFile(
      getFixturePath("courses.html"),
      "utf-8",
    );
    nock("https://ru.hexlet.io").get("/courses").reply(200, htmlFixture);

    // 2. Мокаем картинку из фикстуры
    const imgData = await fs.readFile(getFixturePath("nodejs.png"));
    nock("https://ru.hexlet.io")
      .get("/assets/professions/nodejs.png")
      .reply(200, imgData);

    // 3. Запускаем pageLoader
    const { filepath } = await pageLoader(pageUrl, tmpDir);

    // 4. Проверяем HTML
    const savedHtml = await fs.readFile(filepath, "utf-8");
    expect(savedHtml).toContain("_files"); // ссылка на папку ресурсов
    expect(savedHtml).toContain("img"); // картинка есть в HTML

    // 5. Проверяем, что изображение сохранено
    const pageName = "ru-hexlet-io-courses";
    const resourcesDir = path.join(tmpDir, `${pageName}_files`);
    const files = await fs.readdir(resourcesDir);
    expect(files.length).toBe(1); // одна картинка
    const savedImgPath = path.join(resourcesDir, files[0]);
    const stat = await fs.stat(savedImgPath);
    expect(stat.isFile()).toBe(true);
  });
});
