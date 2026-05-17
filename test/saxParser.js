/**
 * test/saxParser
 *
 * Test SAX.js parser.
 */

import sax from "sax";
import fs from "node:fs/promises";

const strict = false; // set to false for html-mode
const options = {
  "trim": true,
  "normalize": true,
  "lowercase": false,
  "xmlns": false,
  "position": false
};

const parser = sax.parser(strict, options);

parser.onerror = function (e) {
  // an error happened.
  console.error(e);
  parser.error = null;
  parser.resume();
};

parser.onopentag = function (node) {
  // opened a tag.  node has "name" and "attributes"
  console.log("opentag: " + JSON.stringify(node));
};

parser.onattribute = function (attr) {
  // an attribute.  attr has "name" and "value"
  console.log("attribute: " + JSON.stringify(attr));
};

parser.ontext = function (t) {
  // got some text.  t is the string of text.
  console.log("text: " + t);
};

parser.onclosetag = function (name) {
  // closed a tag.  node has "name" and "attributes"
  console.log("closetag: " + name);
};

parser.onend = function () {
  // parser stream is done, and ready to have more stuff written to it.
  console.log("end:");
};

// parser.write('<xml>Hello, <who name="world">world</who>!</xml>');
// parser.close();

(async () => {
  let fh = await fs.open("./test/data/html/helloworld.html", "r")

  while (true) {
    let { bytesRead, buffer } = await fh.read();
    if (bytesRead)
      parser.write(buffer);
    else
      break;
  }

  await fh.close();
  parser.close();
})();
