#!/usr/bin/env node
import { program } from 'commander'
import pageLoader from '../index.js'

program
  .name('page-loader')
  .argument('<url>', 'page URL')
  .option('-o, --output <dir>', 'output directory', process.cwd())
  .action(async (url, options) => {
    try {
      const { filepath } = await pageLoader(url, options.output)
      console.log(`Page successfully loaded to: ${filepath}`)
      process.exit(0)
    }
 catch (error) {
      console.error(`Error loading page: ${error.message}`)
      process.exit(1)
    }
  })

program.parse(process.argv)
