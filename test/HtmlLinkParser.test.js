/**
 * test/testParser.js
 */

import HtmlLinkParser from "../lib/HtmlLinkParser.js";
import fs from "node:fs/promises";
import path from "node:path";
import compareFiles from "./_compareFiles.js";

async function test(options) {
  try {
    let outputName = path.parse(options.url || options.data).name;

    if (options.data) {
      options.data = await fs.readFile(options.data);
      //options.data = new Uint8Array(fs.readFile(options.data));
      outputName += "_data";
    }

    console.log(outputName);
    let outputFile = "./test/output/HtmlLinkParser/" + outputName + ".json";
    console.log("output: " + outputFile);

    let parser = new HtmlLinkParser(options);
    let rows = await parser.parse();

    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, JSON.stringify(rows, null, 2));

    let expectedFile = outputFile.replace("/output/", "/expected/");
    let exitCode = compareFiles(outputFile, expectedFile, 2);
    return exitCode;
  }
  catch (err) {
    console.error(err);
    return 1;
  }
}

(async () => {
  if (await test({ url: "./test/data/html/helloworld.html", terms: ["world"] })) return 1;
  if (await test({ data: "./test/data/html/helloworld.html", terms: ["Universe"] })) return 1;
})();
