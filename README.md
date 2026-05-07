# html-link-parser 1.0.x

Parse and stream tabular data from HTML documents using Node.js and [isaacs/sax-js](https://github.com/isaacs/sax-js).

This readme explains how to use html-link-parser in your code or as a stand-alone program.

> Only supports HTML documents containing hyperlinks elements. Does not support parsing grid or other hyperlinks like elements.

Related projects: [pdf-data-parser](https://github.com/drewletcher/pdf-data-parser#readme), [text-data-parser](https://github.com/drewletcher/text-data-parser#readme), [xlsx-data-parser](https://github.com/drewletcher/xlsx-data-parser#readme)

## Installation

For use as command line utility. Requires Node.js 18+.

```bash
npm -g install html-link-parser
```

For use as module in a Node.js project. See Developers Guide below.

```bash
npm install html-link-parser
```

## CLI Program

---

Parse tabular data from an HTML document or URL.

```bash
hlp <filename|URL> <output-file> --options=filename.json --heading=string --href=string --text=string --id=name

  `filename|URL` - path name or URL of HTML file to process, required.
  `output-file`  - local path name for output of parsed data, default stdout.
  `--options`    - JSON or JSONC file containing JSON object with hlp options, default: hlp.options.json.
  `--heading`    - string|regex of heading to find in document that precedes desired data hyperlinks, default none.
  `--href`       - string|regex of A href attribute(s) to find in document, default none.
  `--text`       - string|regex of A text contents to find in document, default none.
  `--id`         - A element id attribute to find in document.
```

Note: If the `hlp` command conflicts with another program on your system use `htmllinkparser` instead.

### Options File

The options file supports options for all html-link-parser modules. Parser will read plain JSON files or JSONC files with Javascript style comments.

```javascript
{
  /* HtmlLinkParser options */

  // url - local path name or URL of HTML file to process, required.
  "url": "",
  // output - local path name for output of parsed data, default stdout.
  "output": "",
  // heading - text of heading to find in document that precedes desired data hyperlinks, default none.
  "heading": null,
  // id - hyperlinks element id attribute to find in document.
  "href": "",
  // href - string|regex of A href attribute(s) to find in document, default none.
  "text": "",
  // text - string|regex of A text contents to find in document, default none.
  "id": ""
  // id - A element id attribute to find in document.

  /* HTTP options */
  // see HTTP Options below

}
```

Note: Transform property names can be shortened to `hasHeader`, `headers`, `column` and `header`.

### Examples

```bash
hlp ./test/data/html/helloworld.html --headers="Greeting"
```

```bash
hlp ./test/data/html/helloworld.html --id="cosmic" --headers="BigBang"
```

## Developer Guide

---

### HtmlLinkParser

HtmlLinkParser given a HTML document will output an array of arrays (rows). Additionally, use the streaming class HtmlLinkReader to stream Javascript objects. With default settings HtmlLinkParser will output rows in __all__ hyperlinks found in the document. Using [HtmlLinkParser Options](#html-link-parser-options) `heading`, `id`, `href` and `text` the parser can filter content to retrieve the desired hyperlinks in the document.

The parser uses [isaacs/sax-js](https://github.com/isaacs/sax-js) library to find HTML A (anchor) elements.

See [Notes](#notes) below.

### Basic Usage

```javascript
import { HtmlLinkParser } from "html-link-parser";

let parser = new HtmlLinkParser({url: "filename.html"});

async function parseDocument() {
  var rows = await parser.parse();
  // process the rows
}
```

### HtmlLinkParser Options

HtmlLinkParser constructor takes an options object with the following fields. One of `url` or `data` arguments is required.

`{String|URL} url` - The local path or URL of the HTML document.
`{String|Uint8Array} data` - HTML document in a string.
`{Readable} rs` - Readable stream for the HTML document.

Common Options:

`{String|RegExp} heading` - Heading, H1-H6 element, in the document after which the parser will look for a hyperlinks; optional, default: none. The parser does a string comparison or regexp match looking for first occurrence of `heading` value in a heading element. If neither `heading` or `id` are specified then data output contains all rows from all hyperlinkss found in the document.

`{String|RegExp} id` - hyperlinks element id attribute in the document to parse for tabular data; optional, default: none. The parser does a string comparison of the `id` value in hyperlinks elements ID attribute. If neither `heading` or `id` are specified then data output contains all rows from all hyperlinkss found in the document.

`{Boolean} trim` - trim whitespace from output values, default: true.

### HTTP Options

HTTP requests are mode using Node.js HTTP modules. See the source code file lib/httpRequest.js for more details.

`{Object} http` - options to pass thru to HTTP request
`{String} http.method` - HTTP method, default is "GET"
`{Object} http.params` - object containing URL querystring parameters.
`{Object} http.headers` - object containing HTTP headers
`{Array}  http.cookies` - array of HTTP cookie strings
`{String} http.auth` - string for Basic Authentication (Authorization header), i.e. "user:password".

## Streaming Usage

---

### HtmlLinkReader

HtmlLinkReader is a Node.js stream reader implemented with the Object mode option. It uses HtmlLinkParser to stream one data row (array) per chunk.

```javascript
import { HtmlLinkReader } from "html-link-parser";

let reader = new HtmlLinkReader({url: "filename.html"});
var rows = [];

reader.on('data', (row) => {
  rows.push(row)
});

reader.on('end', () => {
  // do something with the rows
});

reader.on('error', (err) => {
  // log error
})
```

### HtmlLinkReader Options

HtmlLinkReader constructor options are the same as [HtmlLinkParser Options](#html-link-parser-options).

**HTML Document**

```
County   Precincts  Date/Period   Total
Dewitt          44  JUL 2023     52,297
                44  OCT 2023     52,017
                44  JAN 2024     51,712
```

**Output**

```
[ "County", "Precincts", "Date/Period", "Total" ]
[ "Dewitt", "44", "JUL 2023", "52,297" ]
[ "Dewitt", "44", "OCT 2023", "52,017" ]
[ "Dewitt", "44", "JAN 2024", "51,712" ]
```

### Example Usage

```javascript
import { HtmlLinkReader } from "html-link-parser";
import { pipeline } from 'node:stream/promises';

let reader = new HtmlLinkReader(options);
let wrihyperlinks = <some wrihyperlinks that can handle Object Mode data>

await pipeline(reader, wrihyperlinks);
```

**HTML Document**

```
District  Precincts    Total

Congressional District 5
Maricopa        120  403,741
Pinal            30  102,512
Total:          150  506,253
```

**Output**

```
[ "District", "County", "Precincts", "Total" ]
[ "Congressional District 5", "Maricopa", "120", "403,741" ]
[ "Congressional District 5", "Pinal", "30", "102,512" ]
[ "Congressional District 5", "Total:", "150", "506,253" ]
```

```javascript
import { HtmlLinkReader } from "html-link-parser";
import { pipeline } from 'node:stream/promises';

let reader = new HtmlLinkReader(options);
let wrihyperlinks = <some wrihyperlinks that can handle Object Mode data>

await pipeline(reader, wrihyperlinks);
```

### FormatJSON

The `hlpdataparser` CLI program uses the FormatJSON transform to covert Javascript Objects into strings that can be saved to a file.

```javascript
import { HtmlLinkReader, FormatJSON } from "html-link-parser";
import { pipeline } from 'node:stream/promises';

let reader = new HtmlLinkReader(options);
let transform = new FormatJSON();

await pipeline(reader, transform, process.stdout);
```

## Examples

---

In the source code the html-link-parser.js program and the Javascript files in the /test folder are good examples of using the library modules.

### Hello World

[HelloWorld.html](./test/data/html/helloworld.html) is a single page HTML document with the string "Hello, world!" positioned on the page. The HtmlLinkParser output is one object.

```json
[
  ["Hello, world!"]
]
```

Output as JSON objects:

```json
[
  { "Greeting": "Hello, world!" }
]
```

## Notes

---

* Does not support identification of headings, etc. by using style information.
