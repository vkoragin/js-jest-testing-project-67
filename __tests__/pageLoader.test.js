import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from '@jest/globals'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import nock from 'nock'
import pageLoader from '../index.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const getFixturePath = (name) => {
  path.join(__dirname, '..', '__fixtures__', name)
}

nock.disableNetConnect()

describe('pageLoader', () => {
  let tmpDir
  const pageUrl = 'https://ru.hexlet.io/courses'
  const pageName = 'ru-hexlet-io-courses'

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'))
  })

  afterEach(async () => {
    nock.cleanAll()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  afterAll(() => {
    nock.enableNetConnect()
  })

  test('downloads page and saves HTML', async () => {
    const html = await fs.readFile(getFixturePath('courses.html'), 'utf-8')

    nock('https://ru.hexlet.io').get('/courses').reply(200, html)

    const { filepath } = await pageLoader(pageUrl, tmpDir)

    expect(filepath).toBe(path.join(tmpDir, `${pageName}.html`))
    const savedHtml = await fs.readFile(filepath, 'utf-8')

    expect(savedHtml.length).toBeGreaterThan(0)
    expect(savedHtml.includes('Курсы по программированию Хекслет')).toBe(true)
    expect(savedHtml.includes('Node.js-программист')).toBe(true)
  })

  test('downloads image and updates path', async () => {
    const html = await fs.readFile(getFixturePath('courses.html'), 'utf-8')
    const imgData = await fs.readFile(getFixturePath('nodejs.png'))

    nock('https://ru.hexlet.io').get('/courses').reply(200, html)
    nock('https://ru.hexlet.io')
      .get('/assets/professions/nodejs.png')
      .reply(200, imgData)

    await pageLoader(pageUrl, tmpDir)

    const resourcesDir = path.join(tmpDir, `${pageName}_files`)
    const files = await fs.readdir(resourcesDir)
    expect(files.length).toBe(1)
    expect(
      files[0].includes('ru-hexlet-io-assets-professions-nodejs.png'),
    ).toBe(true)

    const savedImg = await fs.readFile(path.join(resourcesDir, files[0]))
    expect(savedImg).toEqual(imgData)

    const savedHtml = await fs.readFile(
      path.join(tmpDir, `${pageName}.html`),
      'utf-8',
    )

    expect(savedHtml.includes(`${pageName}_files/${files[0]}`)).toBe(true)
    expect(savedHtml.includes('/assets/professions/nodejs.png')).toBe(false)
  })

  test('throws error on 404 status', async () => {
    nock('https://ru.hexlet.io').get('/courses').reply(404)

    await expect(pageLoader(pageUrl, tmpDir)).rejects.toThrow(
      `Failed to load ${pageUrl}: status 404`,
    )
  })

  test('skips broken resources and continues', async () => {
    const html = `
      <html>
        <img src="/ok.png">
        <img src="/fail.png">
      </html>
    `

    nock('https://ru.hexlet.io').get('/courses').reply(200, html)
    nock('https://ru.hexlet.io').get('/ok.png').reply(200, 'ok')
    nock('https://ru.hexlet.io').get('/fail.png').reply(404)

    await pageLoader(pageUrl, tmpDir)

    const resourcesDir = path.join(tmpDir, `${pageName}_files`)
    const files = await fs.readdir(resourcesDir)
    expect(files.length).toBe(1)
    expect(files[0].includes('ok.png')).toBe(true)

    const savedHtml = await fs.readFile(
      path.join(tmpDir, `${pageName}.html`),
      'utf-8',
    )
    expect(savedHtml.includes(`${pageName}_files/${files[0]}`)).toBe(true)
    expect(savedHtml.includes('/fail.png')).toBe(true)
  })
})
