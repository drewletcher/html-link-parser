# html-link-parser 1.1.x

Parse and stream hyperlinks from HTML documents using Node.js and [isaacs/sax-js](https://github.com/isaacs/sax-js). This library is meant to be used for specialized web page crawlers, data scrapers and adhoc queries. It is not intended to be part of a general purpose web crawling indexer.

This readme explains how to use `html-link-parser` in your Javascript code or as a console program using the command line interface (CLI).

> Definitions
>
> `hyperlink` refers to A element attributes and text including the attributes and text of any inner child elements, for example IMG and SPAN elements.
>
> A `term` is a substring or regular expression used in matching element attributes and text. Parsing returns hyperlinks that match any term.

Related projects:
[html-data-parser](https://github.com/drewletcher/html-data-parser#readme) |
[text-data-parser](https://github.com/drewletcher/text-data-parser#readme) |
[pdf-data-parser](https://github.com/drewletcher/pdf-data-parser#readme) |
[xlsx-data-parser](https://github.com/drewletcher/xlsx-data-parser#readme)

## Installation

For use as module in a Node.js project. See Developers Guide below.

```bash
npm install html-link-parser
```

For use as command line utility. Requires Node.js 18+.

```bash
npm -g install html-link-parser
```

## Command Line Interface

Run the program with the following arguments to parse hyperlinks from a local HTML document or HTTP URL.

```bash
hlp <filename|URL> <output-file> --options=hlp.options.json --tag=tag --heading=term --terms=term1,term2,...

  `filename|URL` - path name or URL of HTML file to process; required.
  `output-file`  - local path name for output; default stdout.
  `--options`    - JSONC file containing JSON object with hlp options; default: hlp.options.json.
  `--tag`        - HTML section tag that contains desired hyperlinks, e.g. 'NAV'; default: none.
  `--heading`    - term to match in heading (H1,H2,...) text that precedes desired hyperlinks; default: none.
  `--terms`      - term(s) to match in HTML attributes and text, separate terms with commas; default: none (all links).
```

Note: If the `hlp` command conflicts with another program on your system use `htmllinkparser` instead.

### Options File

The options file supports all options for html-link-parser modules. Parser will read plain JSON files or JSONC files with Javascript style comments. The default name of the options file is `hlp.options.json` located in the current working directory.

```javascript
{
  /* HtmlLinkParser options */

  // url - local path name or URL of HTML file to process; required.
  "url": "",
  // output - local path name for output of parsed data; default stdout.
  "output": "",
  // tag - HTML section tag that contains desired hyperlinks, e.g. NAV; default: none.
  "tag": null,
  // heading - term to match in heading (H1,H2,...) that precedes desired hyperlinks; default: none.
  "heading": null,
  // terms - array of terms to match in element attributes and text including inner elements of A.
  "terms": [],
  // attributes - attributes to match and return from hyperlink elements, inner text is always matched
  "attributes": [
    "HREF",
    "ID",
    "ALT",
    "TITLE"
  ],

  /* HTTP options */
  // see HTTP Options below

}
```

### Examples

```bash
hlp ./test/data/html/helloworld.html --heading="Greeting"
```

```bash
hlp ./test/data/html/helloworld.html --terms="/.*hello.*/i"
```

### Link Object Output

Basic output always contains href and text properties.

```json
{
  "href": "https://world.com",
  "text": "Hello World!"
}
```

Output where A contains an inner IMG element.

```json
{
  "href": "/alabama-votes/register-to-vote",
  "text": "",
  "alt": "Voter Registration"
}
```

Most output will contain a `tags` property with section tags in hierarchical order and `heading` text of closest heading (H1,H2,...).

```json
{
  "href": "http://www.alabamavotes.gov/",
  "text": "Elections",
  "tags": [
    "HEADER",
    "NAV"
  ],
  "heading": "Main navigation"
}
```

Output where the hyperlink is in a table cell contains all inner text from the TD elements of the row concatenated into one string and output in the `table` property.

```JSON
{
  "href": "/sites/default/files/election-data/2026-04/ALVR-2026_0.xlsx",
  "text": "",
  "alt": "Voter Registration Statistics - 2026 PDF",
  "tags": [
    "MAIN",
    "TABLE"
  ],
  "heading": "Breadcrumb",
  "table": "2026 Voter Registration Statistics - 2026 Statistics on the number of registered voters. This file includes year to date figures for 2026."
}
```

Other properties that may appear in output objects are `id` and `title`.  These attribute values may come from the A element or its child elements.

## Developer Guide

### Basic Usage

The parser processes the entire document then returns the hyperlink data as an array of link objects.

```javascript
import { HtmlLinkParser } from "html-link-parser";

let parser = new HtmlLinkParser({url: "filename.html"});

async function parseDocument() {
  var links = await parser.parse();
  // process the links array
}
```

### Using Event Interface

Listen to parser events and process each hyperlink object as it is parsed from the document.

```javascript
import { HtmlLinkParser } from "html-link-parser";

let parser = new HtmlLinkParser({url: "filename.html"});

parser.on('head', (head) => {
  // zero or one event per document
  // triggered by /HEAD end tag.
  // head object contains { URL, title, redirected } properties
})

parser.on('data', (link) => {
  // a single link object
  // process the link object
});

parser.on('end', () => {
});

parser.on('error', (err) => {
  // log error
})
```

### Using Stream Interface

Process hyperlink objects as they are parsed from the document using the NodeJS Stream interface.

```javascript
import { HtmlLinkReader } from "html-link-parser";
import { pipeline } from 'node:stream/promises';

let reader = new HtmlLinkReader(options);
let writer = '<writer that can handle Object Mode>'

await pipeline(reader, writer);
```

## Class HtmlLinkParser

`HtmlLinkParser` given a HTML document will output an array of link objects. Use the streaming class `HtmlLinkReader` to stream Javascript objects. With default settings `HtmlLinkParser` will output __all__ hyperlinks found in the document. Using [HtmlLinkParser Options](#html-link-parser-options) `tag`, `heading`, and `terms` the parser can filter content to retrieve the desired hyperlinks in the document.

The parser uses [isaacs/sax-js](https://github.com/isaacs/sax-js) library to find HTML A (anchor) and other elements in one pass through the document. Sax does not build an DOM object hierarchy.

See [Notes](#notes) below.

### HtmlLinkParser Options

`HtmlLinkParser` constructor takes an options object with the following fields. One of `url` or `data` arguments is required.

`{String|URL} url` - The local path or URL of the HTML document.
`{String|Uint8Array} data` - HTML document in a string.
`{Readable} rs` - Readable stream for the HTML document.

Common Options:

`{String} tag` - An HTML tag to find in the document. Hyperlink A elements that are children of this tag will be processed. This would usually be a section type element; "HEADER", "FOOTER", "NAV", "MAIN", "ASIDE", "ARTICLE", "SECTION", "TABLE"

`{String|RegExp} heading` - Heading (H1-H6) element in the document after which the parser will look for a hyperlinks; optional, default: none. The parser does a string comparison or regexp match looking for first occurrence of `heading` value in a heading element. Searching will continue until another heading of equal level or higher is encountered.

`{Array<String|RegExp>} terms` - terms to search for in hyperlink (A) attributes and inner text; optional, default: none. The parser does a string comparison or regexp match on attributes and inner text including child elements.

Notes: If `tag`, `heading` and `terms` options are not specified then all hyperlinks found in the document are output.

### HTTP Options

HTTP requests are mode using Node.js HTTP modules. See the source code file lib/httpRequest.js for more details.

`{Object} http` - options to pass thru to HTTP request
`{String} http.method` - HTTP method, default is "GET"
`{Object} http.params` - object containing URL querystring parameters.
`{Object} http.headers` - object containing HTTP headers
`{Array}  http.cookies` - array of HTTP cookie strings
`{String} http.auth` - string for Basic Authentication (Authorization header), i.e. "user:password".

## Class HtmlLinkReader

`HtmlLinkReader` is a Node.js stream reader implemented with the Object mode option. It uses `HtmlLinkParser` event interface to stream one link object per chunk.

### HtmlLinkReader Options

`HtmlLinkReader` constructor options are the same as [HtmlLinkParser Options](#html-link-parser-options).

## Class FormatJSON

The `hlpdataparser` CLI program uses the FormatJSON transform to stringify the link objects as an array that can be saved to a JSON file.

```javascript
import { HtmlLinkReader, FormatJSON } from "html-link-parser";
import { pipeline } from 'node:stream/promises';

let reader = new HtmlLinkReader(options);
let transform = new FormatJSON();

await pipeline(reader, transform, process.stdout);
```

## Examples

---

See the source code for the `html-link-parser.js` program and the Javascript files in the `/test` folder for examples of using the library modules.

### Hello World

[HelloWorld.html](./test/data/html/helloworld.html) is a simple HTML document with the hyperlink "Hello, world!". The `HtmlLinkParser` output is one object.

```bash
hlp ./test/data/html/helloworld.html --terms="world"
```

```html
<html>
<body>
  <a href="https://world.com">Hello World!</a>
</body>
</html>
```

```json
[
  {
    "href": "https://world.com",
    "text": "Hello World!"
  }
]
```

## Notes

---

* Does not support identification of elements by using style information.
