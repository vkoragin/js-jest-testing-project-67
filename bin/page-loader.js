import { program } from "commander";
import pageLoader from "../src/index.js";

program
  .name("page-loader")
  .description("Downloads a webpage and saves it locally")
  .version("1.0.0")
  .argument("<url>")
  .option("-o, --output <dir>", "output directory", process.cwd())
  .action(async (url, options) => {
    try {
      const { filepath } = await pageLoader(url, options.output);
      console.log(filepath);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
