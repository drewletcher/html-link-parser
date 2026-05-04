# html-link-parser 1.0.x

Parse and stream tabular data from HTML documents using Node.js and [isaacs/sax-js](https://github.com/isaacs/sax-js).

This readme explains how to use html-link-parser in your code or as a stand-alone program.

> Only supports HTML documents containing TABLE elements. Does not support parsing grid or other table like elements.

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
hlp <filename|URL> <output-file> --options=filename.json --heading=title --id=name --cells=# --headers=name1,name2,... --format=csv|json|rows

  `filename|URL` - path name or URL of HTML file to process, required.
  `output-file`  - local path name for output of parsed data, default stdout.
  `--options`    - JSON or JSONC file containing JSON object with hlp options, default: hlp.options.json.
  `--heading`    - text of heading to find in document that precedes desired data table, default none.
  `--id`         - TABLE element id attribute to find in document.
  `--cells`      - number of cells in a data row, minimum or "min-max", default = "1-256".
  `--headers`    - comma separated list of column names for data, default none the first table row contains names.
  `--format`     - output data format CSV, JSON, or ROWS (JSON array of arrays), default JSON.
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
  // format - output data format CSV, JSON or rows, default JSON, rows is JSON array of arrays (rows).
  "format": "json",
  // heading - text of heading to find in document that precedes desired data table, default none.
  "heading": null,
  // id - TABLE element id attribute to find in document.
  "id": "",
  // cells - number of cells for a data row, minimum or "min-max", default = "1-256".
  "cells": "1-256",
  // newlines - preserve new lines in cell data, default: false.
  "newlines": false,
  // trim whitespace from output values, default: true.
  "trim": true,

  /* RowAsObjectTransform options */

  // hasHeaders - data has a header row, if true and headers set then headers overrides header row.
  "RowAsObject.hasHeader": false
  // headers - comma separated list of column names for data, default none. When not defined the first table row encountered will be treated as column names.
  "RowAsObject.headers": []

  /* HTTP options */
  // see HTTP Options below

}
```

Note: Transform property names can be shortened to `hasHeader`, `headers`, `column` and `header`.

### Examples

```bash
hlp ./test/data/html/helloworld.html --headers="Greeting" --format=csv
```

```bash
hlp ./test/data/html/helloworld.html --id="cosmic" --headers="BigBang"
```

## Developer Guide

---

### HtmlLinkParser

HtmlLinkParser given a HTML document will output an array of arrays (rows). Additionally, use the streaming classes HtmlLinkReader and RowAsObjectTransform transform to convert the arrays to Javascript objects.  With default settings HtmlLinkParser will output rows in __all__ TABLE found in the document. Using [HtmlLinkParser Options](#html-link-parser-options) `heading` or `id` the parser can filter content to retrieve the desired data TABLE in the document.

HtmlLinkParser only works on a certain subset of HTML documents specifically those that contain some TABLE elements and NOT other table like grid elements. The parser uses [isaacs/sax-js](https://github.com/isaacs/sax-js) library to transform HTML table elements into rows of cells.

Rows and Cells terminology is used instead of Rows and Columns because the content in a HTML document flows rather than strict rows/columns of database query results. Some rows may have more cells than other rows. For example a heading or description paragraph will be a row (array) with one cell (string).  See [Notes](#notes) below.

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

`{String|RegExp} heading` - Heading, H1-H6 element, in the document after which the parser will look for a TABLE; optional, default: none. The parser does a string comparison or regexp match looking for first occurrence of `heading` value in a heading element. If neither `heading` or `id` are specified then data output contains all rows from all tables found in the document.

`{String|RegExp} id` - TABLE element id attribute in the document to parse for tabular data; optional, default: none. The parser does a string comparison of the `id` value in TABLE elements ID attribute. If neither `heading` or `id` are specified then data output contains all rows from all tables found in the document.

`{Number} cells` - Minimum number of cells in tabular data; optional, default: 1. The parser will NOT output rows with less than `cells` number of cells.

`{Boolean} newlines` - Preserve new lines in cell data; optional, default: false. When false newlines will be replaced by spaces. Preserving newlines characters will keep the formatting of multiline text such as descriptions. Though, newlines are problematic for cells containing multi-word identifiers and keywords that might be wrapped in the cell text.

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

### RowAsObjectTransform

HtmlLinkReader operates in Object Mode. The reader outputs arrays (rows). To convert rows into Javascript objects use the RowAsObjectTransform transform.  HtmlLinkReader operates in Object mode where a chunk is a Javascript Object of <name,value> pairs.

```javascript
import { HtmlLinkReader, RowAsObjectTransform } from "html-link-parser";
import { pipeline } from 'node:stream/promises';

let reader = new HtmlLinkReader(options);
let transform1 = new RowAsObjectTransform(options);
let writable = <some writable that can handle Object Mode data>

await pipeline(reader, transform1, writable);
```

### RowAsObjectTransform Options

RowAsObjectTransform constructor takes an options object with the following fields.

`{String[]} headers` - array of cell property names; optional, default: none. If a headers array is not specified then parser will assume the first row found contains cell property names.

`{Boolean} hasHeaders` - data has a header row, if true and headers options is set then provided headers override header row. Default is true.

If a row is encountered with more cells than in the headers array then extra cell property names will be the ordinal position. For example if the data contains five cells, but only three headers where specified.  Specifying `options = { headers: [ 'name', 'type', 'info' ] }` then the Javascript objects in the stream will contain `{ "name": "value1", "type": "value2", "info": "value3", "4": "value4", "5": "value5" }`.

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
let writable = <some writable that can handle Object Mode data>

await pipeline(reader, writable);
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
let writable = <some writable that can handle Object Mode data>

await pipeline(reader, writable);
```

### FormatCSV and FormatJSON

The `hlpdataparser` CLI program uses the FormatCSV and FormatJSON transforms to covert Javascript Objects into strings that can be saved to a file.

```javascript
import { HtmlLinkReader, RowAsObjectTransform, FormatCSV } from "html-link-parser";
import { pipeline } from 'node:stream/promises';

let reader = new HtmlLinkReader(options);
let transform1 = new RowAsObjectTransform(options);
let transform2 = new FormatCSV();

await pipeline(reader, transform1, transform2, process.stdout);
```

## Examples

---

In the source code the html-link-parser.js program and the Javascript files in the /test folder are good examples of using the library modules.

### Hello World

[HelloWorld.html](./test/data/html/helloworld.html) is a single page HTML document with the string "Hello, world!" positioned on the page. The HtmlLinkParser output is one row with one cell.

```json
[
  ["Hello, world!"]
]
```

To transform the row array into an object specify the headers option to RowAsObjectTransform transform.

```javascript
let transform = new RowAsObjectTransform({
  headers: [ "Greeting" ]
})
```

Output as JSON objects:

```json
[
  { "Greeting": "Hello, world!" }
]
```

## Notes

---

* Only supports HTML files containing TABLE elements. Does not support other table like grid elements.
* Does not support identification of titles, headings, column headers, etc. by using style information for a cell.
* Vertical spanning cells are parsed with first row where the cell is encountered. Subsequent rows will not contain the cell and have one less cell. Currently, vertical spanning cells must be at the end of the row otherwise the ordinal position of cells in the following rows will be incorrect, i.e. missing values are not supported.
