/**
 * lib/HtmlLinkParser
 *
 * Gets hyperlinks from HTML.
 *
 * streams found links or returns an array of link objects.
 */
"use strict";

import EventEmitter from 'node:events';
import sax from 'sax';
import fs from 'node:fs';
import httpRequest from './httpRequest.js';
import { Readable, Writable } from 'node:stream';
import { pipeline, finished } from 'node:stream/promises';

function isHeading(tag) {
  return tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4" || tag === "H5" || tag === "H6";
}

/**
* Compares text against a term.
* @param {String} text - text to search within
* @param {String|RegExp} term - term to compare against, can be a substring or regular expression
*/
function compareText(text, term) {
  if (!text)
    return false;

  if (Object.prototype.toString.call(term).slice(8, -1) === "String") {
    if (term.startsWith("/") && (term.endsWith("/") || term.endsWith("/i"))) {
      term = new RegExp(term.slice(1, term.lastIndexOf("/")), term.endsWith("/i") ? "i" : "");
    }
  }

  if (Object.prototype.toString.call(term).slice(8, -1) === "RegExp")
    return term.test(text);
  else
    return text.includes(term);
}

export default class HtmlLinkParser extends EventEmitter {

  /**
   * @param {Object}  options
   *
   * @param {String|URL}        [options.url] - the URL or local file name of the .html
   * @param {String|Uint8Array} [options.data] - HTML file data in an array, instead of using url
   * @param {Readable}          [options.rs] readable stream with source data
   *
   * @param {String|RegExp}        [options.heading] - HTML section heading where data is located, default: none (first table)
   * @param {Array<String|RegExp>} [options.terms]      - terms to match in the search, default: none (all links)
   *
   * @param {Array<String>} [options.attributes] - attribute names to include in search, default: [ "HREF", "ID", "ALT" ]
   */
  constructor(options = {}) {
    super({ captureRejections: true });

    this.options = Object.assign({
      tags: [ "HEADER", "FOOTER", "NAV", "MAIN", "ASIDE", "ARTICLE", "SECTION", "TABLE" ],
      attributes: [ "HREF", "ID", "ALT", "TITLE" ],
      terms: [],
      trim: true
    }, options);

    // SAX parser
    this.saxOptions = {
      "trim": this.options.trim
    };

    // parser state
    this.started = false;
    this.paused = false;
    this.cancelled = false;

    // search output
    this.links = [];
    this.count = 0;
  }

  /**
   * Load and parse the HTML document.
   * @returns an array of link objects.
   * If using an event listener the return value will be an empty array.
   */
  async parse() {
    try {
      // parsing properties
      this.started = true;

      // heading filters
      let findTag = Object.hasOwn(this.options, "tag");
      let findHeading = Object.hasOwn(this.options, "heading");
      let foundTag = !findTag && !findHeading;
      let headingTag = "";  // tag of found heading: H1, H2, H3, H4, H5, H6

      // track hierarchy of node elements
      const nodeStack = [];
      const currNode = () => {
        return nodeStack.length > 0 ? nodeStack[ nodeStack.length - 1 ] : null;
      };
      const tagStack = []; // track elements of interest (NAV, SECTION, TABLE, etc.)

      // current values
      let inAnchor = false;  // true while processing an A element and inner elements
      let innerText = "";     // including inner elements of the link element
      let inHeading = false;
      let headingText = "";
      let inTableRow = false;
      let rowText = "";

      // current link object being built
      let foundLink = false;
      let link = null;

      // open the input stream
      // pipe is supported, and it's readable/writable
      // same chunks coming in also go out.
      var rs;
      if (this.options.rs) {
        rs = this.options.rs;
      }
      else if (this.options.data) {
        rs = Readable.from(this.options.data);
      }
      else if (typeof this.options.url === "string" && !this.options.url.toLowerCase().startsWith("http")) {
        rs = fs.createReadStream(this.options.url);
      }
      else {
        rs = await httpRequest.createReadStream(this.options.url, this.options.http);
        let count = 0;
        while (rs.statusCode == 301 || rs.statusCode == 302) {
          ++count;
          if (count > 10) {
            throw new Error("Too many redirects");
          }
          let location = rs.headers.location;
          rs.resume();  // drain the stream
          console.log("REDIRECT: " + rs.statusCode + " " + location);
          rs = await httpRequest.createReadStream(location, this.options.http);
        }
        if (rs.statusCode !== 200) {
          rs.resume();  // drain the stream
          throw new Error(rs.statusCode + " " + rs.statusMessage + " " + this.options.url);
        }
      }

      const strict = false;  // set to false for HTML mode, i.e. support invalid XML
      const saxStream = this.saxStream = sax.createStream(strict, this.saxOptions);
      let self = this;

      /// opentag
      saxStream.on("opentag", function (node) {
        // node object with properties: name, attributes, isSelfClosing
        //console.log("opentag: " + JSON.stringify(node) + "\r\n");
        let tag = node.name;

        nodeStack.push(node);
        if (self.options.tags.includes(tag))
          tagStack.push(node);

        if (findTag && tag === self.options.tag) {
          foundTag = true;
        }

        if (isHeading(tag)) {
          inHeading = true;
          headingText = "";

          if (findHeading && foundTag) {
            // check for next heading which would turn off link matching,
            // a heading element at same or higher level
            if (tag <= headingTag) {
              foundTag = false;
              headingTag = "";
            }
          }
        }

        if (tag === "A") {
          inAnchor = true;
          innerText = "";
        }

        if (tag === "TR") {
          inTableRow = true;
          rowText = "";
        }

      });

      /// text
      saxStream.on("text", function (s) {
        // inner text string(s)
        //console.log("text: " + s + "\r\n");
        let tag = currNode().name;

        if (isHeading(tag)) {
          headingText += headingText ? " " + s : s;
        }

        if (inAnchor) {
          // text from A and inner elements
          innerText += innerText ? " " + s : s;
        }

        if (inTableRow) {
          // munge all TD text into one string
          rowText += rowText ? " " + s : s;
        }
      });

      /// closetag
      saxStream.on("closetag", function (tag) {
        // tag name
        //console.log("closetag: " + tag + "\r\n");
        let node = nodeStack.pop();
        if (self.options.tags.includes(node.name))
          tagStack.pop();

        if (tag !== node.name) {
          throw new Error("Mismatched tag");
        }

        if (findTag && tag === self.options.tag) {
          foundTag = false;
        }

        if (isHeading(tag)) {
          inHeading = false;
          // compare heading text
          if (findHeading && !foundTag && compareText(headingText, self.options.heading)) {
            foundTag = true;
            headingTag = tag;
          }
        }

        if (foundTag && self.options.terms.length === 0) {
          // all links in document
          foundLink = true;
        }

        if (inAnchor && foundTag && !foundLink) {
          // compare node attributes
          for (let attr of self.options.attributes) {
            if (attr in node.attributes) {
              for (let term of self.options.terms) {
                foundLink |= compareText(node.attributes[ attr ], term);
                if (foundLink) {
                  //console.log("found attribute: " + tag + " " + node.attributes[ attr ]);
                  break;
                }
              }
            }
          }
        }

        if (tag === "A" && foundTag && !foundLink) {
          // compare A inner text
          for (let term of self.options.terms) {
            foundLink |= (compareText(innerText, term));
            if (foundLink) {
              //console.log("found text: " + innerText);
              break;
            }
          }
        }

        if (tag === "TR") {
          inTableRow = false;
        }

        if (inAnchor && foundLink) {
          // fill in attributes from the A element and inner elements
          if (link === null)
            link = {};

          for (let attr of self.options.attributes) {
            if (attr in node.attributes)
              link[ attr.toLowerCase() ] = decodeURI(node.attributes[ attr ]);
          }

          if (tag === "A" && foundLink) {
            // output the link object
            link.text = innerText;
            if (tagStack.length)
              link.tags = tagStack.map(node => node.name);
            if (headingText)
              link.heading = headingText;
            if (rowText)
              link.table = rowText;
            self.push(link);

            inAnchor = false;
            foundLink = false;
            link = null;
          }
        }

      });

      /// doctype
      saxStream.on("doctype", function (s) {
        // doctype string
        //console.log("doctype: " + JSON.stringify(s) + "\r\n");
      });

      /// opentagstart
      saxStream.on("opentagstart", function (node) {
        // node object with name, attributes (empty)
        //console.log("opentagstart: " + JSON.stringify(node) + "\r\n");
      });

      /// attribute
      saxStream.on("attribute", function (attr) {
        // attribute object with name, value
        //console.log("attribute: " + JSON.stringify(attr) + "\r\n");
      });

      /// processinginstruction
      saxStream.on("processinginstruction", function (o) {
        // object with "name", "body"
        //console.log("processinginstruction: " + JSON.stringify(o) + "\r\n");
      });

      /// comment
      saxStream.on("comment", function (s) {
        // comment string
        //console.log("comment: " + JSON.stringify(s) + "\r\n");
      });

      /// script
      saxStream.on("script", function (s) {
        // script contents as string
        //console.log("script: " + JSON.stringify(s) + "\r\n");
      });

      /// opencdata
      saxStream.on("opencdata", function (tag) {
        // tag name
        //console.log("opencdata: " + tag + "\r\n");
      });

      /// cdata
      saxStream.on("cdata", function (s) {
        // inner text string
        //console.log("cdata: " + s + "\r\n");
      });

      /// closecdata
      saxStream.on("closecdata", function (tag) {
        // tag name
        //console.log("closecdata: " + tag + "\r\n");
      });

      /// end
      saxStream.on("end", function () {
        // stream has closed
        //console.log("end:" + "\r\n");
      });

      /// ready
      saxStream.on("ready", function () {
        // parser reset, ready to be reused.
        //console.log("ready:" + "\r\n");
      });

      /// error
      saxStream.on("error", function (e) {
        // unhandled error
        console.error("error: ", e)
        // clear the error
        this._parser.error = null
        this._parser.resume()
      });

      /// setup sax parser pipeline

      // create a data sink, because saxStream doesn't seem to be a proper async Writable
      let ws = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });

      let pipes = [];
      pipes.push(rs);
      pipes.push(saxStream);
      pipes.push(ws);
      pipeline(pipes);

      await finished(ws);

      this.emit("end");
      return this.links;
    }
    catch (err) {
      //console.error(err);
      this.emit("error", err);
    }
  }

  pause() {
    // console.debug("parser pause");
    this.paused = true;
    //this.saxStream.pause();
  }

  resume() {
    // console.debug("parser resume");
    if (this.paused && !this.cancelled) {
      this.paused = false;
      this.saxStream.resume();
    }
  }

  cancel() {
    // console.debug("parser cancel");
    this.cancelled = true;
    this.saxStream.destroy();
  }

  /**
   * Emits or appends data to links array.
   *
   * @param {*} link is an object with href and text properties.
   */
  async push(link) {
    if (this.listenerCount("data") > 0)
      this.emit("data", link);
    else
      this.links.push(link);

    this.count++;
  }

};
