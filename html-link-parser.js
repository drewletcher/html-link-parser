#!/usr/bin/env node
/* eslint-disable node/shebang */
/**
 * html-link-parser
 */
"use strict";

import HtmlLinkReader from "./lib/HtmlLinkReader.js";
import FormatJSON from "./lib/FormatJSON.js";
import { parse } from "jsonc-parser";
import Package from "./package.json" with { type: 'json' };
import colors from 'colors';

import { open, readFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { stdout } from 'node:process';

colors.enable();

// default program options
var options = {
  url: "",
  output: "",
  trim: true
}

/**
 * parseArgs
 *   only filename is required
 *   example ["node.exe", "html-link-parser.js", <filename.html|URL>, <output>, --tag="HTML TAG" --heading="title" --terms="term1,term2,..." ]
 */
async function parseArgs() {
  let clOptions = {}; // command line options
  let ofOptions = {}; // options file options
  let optionsfile = "hlp.options.json";

  let i = 2;
  while (i < process.argv.length) {
    let arg = process.argv[ i ];

    if (arg[ 0 ] !== "-") {
      if (!clOptions.url)
        clOptions.url = arg;
      else
        clOptions.output = arg;
    }
    else {
      let nv = arg.split('=');

      if (nv[ 0 ] === "--options")
        optionsfile = nv[ 1 ];
      else if (nv[ 0 ] === "--tag")
        clOptions.tag = nv[ 1 ];
      else if (nv[ 0 ] === "--heading")
        clOptions.heading = nv[ 1 ];
      else if (nv[ 0 ] === "--terms")
        clOptions.terms = nv[ 1 ].split(",");
      else if (nv[ 0 ] === "--trim")
        clOptions.trim = nv[ 1 ] === "true";
    }
    ++i;
  }

  if (optionsfile) {
    try {
      let opts = await readFile(optionsfile, { encoding: 'utf8' });
      let perrors = [];
      let poptions = {
        disallowComments: false,
        allowTrailingComma: true,
        allowEmptyContent: false
      };
      ofOptions = parse(opts, perrors, poptions)
    }
    catch (err) {
      if (err.code !== 'ENOENT' || optionsfile != "hlp.options.json")
        throw err;
    }
  }

  Object.assign(options, ofOptions, clOptions);
}

/**
 * Program entry point.
 */
(async () => {
  let retCode = 0;

  await parseArgs();

  let stdoutput = options.output === "" || !options.url;

  if (!stdoutput) {
    console.log("hlp HTML Link Parser " + Package.version);
    console.log("Copyright 2024 Drew O. Letcher | The MIT License");
  }

  if (!options.url) {
    console.log("");
    console.log("Parse tabular data from a HTML file.");
    console.log("");
    console.log("hlp <filename.html|URL> <output> --options=filename.json --tag=tag --heading=term --terms=term1,term2,...");
    console.log("");
    console.log("  filename|URL - path name or URL of HTML file to process; required.");
    console.log("  output       - local path name for output of parsed data; default stdout.");
    console.log("  --options    - JSON or JSONC file containing hlp options; default: hlp.options.json.");
    console.log("  --tag        - HTML section tag that contains desired hyperlinks, e.g. 'NAV'; default: none.")
    console.log("  --heading    - term to match in heading (H1,H2,...) that precedes desired hyperlinks; default: none.");
    console.log("  --terms      - term(s) to match in A attributes and text, separate terms with commas; default: none (all links).");
    console.log("");
    return;
  }

  try {
    let pipes = [];

    let reader = new HtmlLinkReader(options);
    pipes.push(reader);

    reader.on("head", (head) => {
      if (head.redirect)
        console.log("head: ".yellow + JSON.stringify(head).yellow);
    });

    let formatter = new FormatJSON(options);
    pipes.push(formatter);

    let writer;
    if (options.output) {
      let fd = await open(options.output, "w");
      writer = fd.createWriteStream();
    }
    else
      writer = process.stdout;
    pipes.push(writer);

    await pipeline(pipes);

    if (options.output)
      writer.end();
  }
  catch (err) {
    console.error(err.message.red);
    retCode = 1;
  }

  if (!stdoutput) {
    if (retCode === 0)
      console.log("parser results OK".green);
    else
      console.log(" parser failed.".red);
  }

  process.exitCode = retCode;
})();
