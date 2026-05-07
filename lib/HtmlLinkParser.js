/**
 * lib/HtmlLinkParser
 *
 * Gets hyperlinks from HTML.
 *
 * pushLink or returns an array of link objects.
 */
"use strict";

import EventEmitter from 'node:events';
import sax from 'sax';
import fs from 'node:fs';
import httpRequest from './httpRequest.js';
import { Readable, Writable } from 'node:stream';
import { pipeline, finished } from 'node:stream/promises';

export default class HtmlLinkParser extends EventEmitter {

  /**
   * @param {Object}  options
   * @param {String|URL}        [options.url] - the URL or local file name of the .html
   * @param {String|Uint8Array} [options.data] - HTML file data in an array, instead of using url
   * @param {Readable}          [options.rs] readable stream with source data
   * @param {String|RegExp}  [options.heading] - HTML section heading where data is located, default: none (first table)
   * @param {String|RegExp}  [options.id] - element id attribute to find in document.
   * @param {String|RegExp}  [options.text] - text to match in the link text, default: none (all links)
   * @param {String|RegExp}  [options.href] - test to match in the link href attribute, default: none (all links)
   */
  constructor(options = {}) {
    super({ captureRejections: true });

    this.options = Object.assign({ trim: true }, options);

    // SAX parser
    this.saxOptions = {
      "trim": this.options.trim
    };

    // parsing properties
    this.links = [];
    this.count = 0;

    // parser state
    this.started = false;
    this.paused = false;
    this.cancelled = false;
  }

  /**
   * Load and parse the HTML document.
   * @returns an array of link objects.
   * If using an event listener the return value will be an empty array.
   */
  async parse() {
    try {
      this.started = true;

      // parsing properties
      let findHeading = Object.hasOwn(this.options, "heading");
      let foundHeading = false;
      let findRefId = Object.hasOwn(this.options, "id");
      let foundLink = false;

      //// table processing
      const tagOpen = {}; // track state of tag open elements

      let headingText = "";
      let linkHref = "";
      let linkText = "";

      let self = this;

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
        if (rs.statusCode !== 200) {
          rs.resume();  // drain the stream
          throw new Error(rs.statusCode + " " + rs.statusMessage + " " + this.options.url);
        }
      }

      const strict = false; // set to false for HTML mode
      const saxStream = this.saxStream = sax.createStream(strict, this.saxOptions);

      saxStream.on("opentag", function (node) {
        // node object with properties: name, attributes, isSelfClosing
        //console.log("opentag: " + JSON.stringify(node) + "\r\n");

        tagOpen[ node.name ] = tagOpen[ node.name ] ? ++tagOpen[ node.name ] : 1;

        switch (node.name) {
          case "A":
            linkHref = node.attributes?.HREF || "";

            if (findRefId) {
              foundLink = self.compareText(self.options.id, node.attributes[ "ID" ]);
              //if (foundLink) console.log("found id: " + node.attributes[ "ID" ]);
            }
            else if (findHeading) {
              foundLink = foundHeading;
              //if (foundLink) console.log("found link under heading: " + headingText);
            }
            else if (self.options.href) {
              foundLink = self.compareText(self.options.href, linkHref);
              //if (foundLink) console.log("found href: " + linkHref);
            }
            else if (!self.options.text) {
              foundLink = true;
              //console.log("found a link");
            }

            break;
        }

      });

      saxStream.on("text", function (s) {
        // inner text string
        //console.log("text: " + s + "\r\n");
        if (tagOpen.H1 || tagOpen.H2 || tagOpen.H3 || tagOpen.H4 || tagOpen.H5 || tagOpen.H6) {
          headingText += headingText ? " " + s : s;
        }

        else if (tagOpen.A)
          linkText += linkText ? " " + s : s;
      });

      saxStream.on("closetag", function (tag) {
        // tag name
        //console.log("closetag: " + tag + "\r\n");

        if (tagOpen.H1 || tagOpen.H2 || tagOpen.H3 || tagOpen.H4 || tagOpen.H5 || tagOpen.H6) {
          if (findHeading && self.compareText(self.options.heading, headingText))
            // need to check to turn off if heading is greater than or equal to current tag level
            foundHeading = true;
          headingText = "";
        }

        switch (tag) {
          case "A":
            if (self.options.text) {
              foundLink |= (self.compareText(self.options.text, linkText));
              //if (foundLink) console.log("found text: " + linkText);
            }

            if (foundLink) {
              self.pushLink({
                href: linkHref,
                text: linkText
              });
            }

            foundLink = false;
            linkHref = "";
            linkText = "";
            break;
        }

        --tagOpen[ tag ];
      });

      saxStream.on("doctype", function (s) {
        // doctype string
        //console.log("doctype: " + JSON.stringify(s) + "\r\n");
      });

      saxStream.on("opentagstart", function (node) {
        // node object with name, attributes (empty)
        //console.log("opentagstart: " + JSON.stringify(node) + "\r\n");
      });

      saxStream.on("attribute", function (attr) {
        // attribute object with name, value
        //console.log("attribute: " + JSON.stringify(attr) + "\r\n");
      });

      saxStream.on("processinginstruction", function (o) {
        // object with "name", "body"
        //console.log("processinginstruction: " + JSON.stringify(o) + "\r\n");
      });

      saxStream.on("comment", function (s) {
        // comment string
        //console.log("comment: " + JSON.stringify(s) + "\r\n");
      });

      saxStream.on("script", function (s) {
        // script contents as string
        //console.log("script: " + JSON.stringify(s) + "\r\n");
      });

      saxStream.on("opencdata", function (tag) {
        // tag name
        //console.log("opencdata: " + tag + "\r\n");
      });

      saxStream.on("cdata", function (s) {
        // inner text string
        //console.log("cdata: " + s + "\r\n");
      });

      saxStream.on("closecdata", function (tag) {
        // tag name
        //console.log("closecdata: " + tag + "\r\n");
      });

      saxStream.on("end", function () {
        // stream has closed
        //console.log("end:" + "\r\n");
      });

      saxStream.on("ready", function () {
        // parser reset, ready to be reused.
        //console.log("ready:" + "\r\n");
      });

      saxStream.on("error", function (e) {
        // unhandled error
        console.error("error: ", e)
        // clear the error
        this._parser.error = null
        this._parser.resume()
      });

      // create a data sink, because saxStream doesn't see to be a proper async Writable
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
    this.saxStream.pause();
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
  *
  * @param {Object} pattern - options.heading value
  * @param {String} text - text to compare
  */
  compareText(pattern, text) {
    if (!text)
      return false;

    if (Object.prototype.toString.call(pattern).slice(8, -1) === "RegExp")
      return pattern.test(text);
    else
      return text.includes(pattern);
  }

  /**
   * Emits or appends data to pushLink.
   *
   * @param {*} link is an object with href and text properties.
   */
  async pushLink(link) {
    if (this.listenerCount("data") > 0)
      this.emit("data", link);
    else
      this.links.push(link);

    this.count++;
  }

};
