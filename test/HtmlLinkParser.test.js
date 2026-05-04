/**
 * test/testParser.js
 */

import HtmlLinkParser from "../lib/HtmlLinkParser.js";
import fs from "node:fs";
import path from "node:path";
import compareFiles from "./_compareFiles.js";

async function test(options) {
  try {
    let outputName = path.parse(options.url || options.data).name;

    if (options.data) {
      options.data = fs.readFileSync(options.data);
      //options.data = new Uint8Array(fs.readFileSync(options.data));
      outputName += "_data";
    }

    let parser = new HtmlLinkParser(options);
    let rows = await parser.parse();

    let outputFile = "./test/output/HtmlLinkParser/" + outputName + ".json";
    console.log("output: " + outputFile);
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(rows, null, 2));

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
  if (await test({ url: "./test/data/html/helloworld.html", id: "global"})) return 1;

  if (await test({ data: "./test/data/html/helloworld.html", id: "cosmic" })) return 1;

})();
