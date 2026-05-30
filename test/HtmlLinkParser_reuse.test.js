/**
 * test/testParser.js
 */

import HtmlLinkParser from "../lib/HtmlLinkParser.js";
import fs from "node:fs/promises";
import path from "node:path";
import compareFiles from "./_compareFiles.js";
import colors from 'colors';

async function test(options) {
  try {
    let outputName = "reuse";

    console.log(outputName);
    let outputFile = "./test/output/HtmlLinkParser/" + outputName + ".json";
    console.log("output: " + outputFile);

    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    let fh = await fs.open(outputFile, "w");
    await fh.write('[\n');

    let parser = new HtmlLinkParser(options);

    parser.on("head", (head) => {
      if (head.redirect)
        console.log("head: ".yellow + JSON.stringify(head).yellow);
    });

    parser.on("data", async (data) => {
      await fh.write(JSON.stringify(data) + ",\n");
    });

    parser.on("end", () => {
      console.log("end".yellow);
    });

    parser.on("error", (err) => {
      console.error("error: ".red + err.toString().red);
    });

    // parse each url in the list
    for (let url of options.urls) {
      console.log("parsing: " + url);
      await fh.write('"parsing: ' + url + '",\n');
      await parser.parse(url);
    }

    await fh.write('"fini"\n]\n');
    await fh.close();
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
  if (await test({
    urls: [
      "https://www.sos.alabama.gov/alabama-votes",
      "https://www.sos.alabama.gov/alabama-votes/voter/election-information"
    ],
    terms: [
      /.*vote.*/i,
      /.*elect.*/i
    ]
  })) return 1;
})();
