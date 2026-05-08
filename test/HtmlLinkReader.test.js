/**
 * test/testReader.js
 */

import HtmlLinkReader from "../lib/HtmlLinkReader.js";
import FormatJSON from '../lib/FormatJSON.js';
import { finished } from 'stream/promises';
import fs from "node:fs";
import path from "node:path";
import compareFiles from "./_compareFiles.js";

async function test(options) {
  let outputName = path.parse(options.url || options.data).name;

  if (options.data) {
    options.data = fs.readFileSync(options.data);
    outputName += "_data";
  }

  let reader = new HtmlLinkReader(options);

  let transform = new FormatJSON();

  let outputFile = "./test/output/HtmlLinkReader/" + outputName + ".json";
  console.log("output: " + outputFile);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  let writer = fs.createWriteStream(outputFile, { encoding: "utf-8", autoClose: false });

  reader.pipe(transform).pipe(writer);
  await finished(writer);

  let expectedFile = outputFile.replace("/output/", "/expected/");
  let exitCode = compareFiles(outputFile, expectedFile, 2);
  return exitCode;
}

(async () => {
  if (await test({ url: "./test/data/html/helloworld.html", terms: [ "global" ] })) return 1;
  if (await test({ data: "./test/data/html/helloworld.html", terms: [ /.*[uU]niverse.*/ ] })) return 1;

  if (await test({ url: "./test/data/html/al_sos.html", terms: [ /.*vote.*/i, /.*elect.*/i ] })) return 1;

  // 301
  if (await test({ url: "http://www.alabamavotes.gov/", terms: [ /(.*vote.*)/i, /(.*elect.*)/i ] })) return 1;

  if (await test({ url: "https://www.sos.alabama.gov/alabama-votes", terms: [ /(.*vote.*)/i, /(.*elect.*)/i ] })) return 1;

  if (await test({
    url: "https://www.sos.alabama.gov/alabama-votes/voter/election-information",
    terms: [
      /.*elect.*/i,
      /.*vote.*/i,
      /.*info.*/i,
      /.*data.*/i,
      /.*general.*/i,
      /.*primary.*/i,
      /.*runoff.*/i,
      /.*special.*/i,
      /.*map.*/i,
      /.*shape.*/i,
      /.*result.*/i,
      /.*summary.*/i,
      /.*upcoming.*/i,
      /.*calendar.*/i,
    ]
  })) return 1;

  if (await test({
    url: "https://www.sos.alabama.gov/alabama-votes/voter/election-data",
    terms: [

      /.*elect.*/i,
      /.*vote.*/i,
      /.*info.*/i,
      /.*data.*/i,
      /.*general.*/i,
      /.*primary.*/i,
      /.*runoff.*/i,
      /.*special.*/i,
      /.*map.*/i,
      /.*shape.*/i,
      /.*result.*/i,
      /.*summary.*/i,
      /.*upcoming.*/i,
      /.*calendar.*/i,
    ]
  })) return 1;

  console.log("All tests passed.");
})();
