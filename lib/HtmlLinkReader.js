
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */
/**
 * lib/HtmlLinkReader
 */
"use strict";

import HtmlLinkParser from "./HtmlLinkParser.js";
import { Readable } from 'stream';

export default class HtmlLinkReader extends Readable {

  /**
   *
   * @param {Object}      options
   * @param {URL|String}  options.url
   * @param {Uint8Array|String} options.data
   */
  constructor(options) {
    let streamOptions = {
      objectMode: true,
      highWaterMark: 16,
      autoDestroy: false
    };
    super(streamOptions);

    this.options = options || {};
    this.parser;
  }

  async _construct(callback) {
    let parser = this.parser = new HtmlLinkParser(this.options);
    var reader = this;

    parser.on('data', (row) => {
      if (row) {
        if (!reader.push(row)) {
          parser.pause();  // If push() returns false stop reading from source.
        }
      }
    });

    parser.on('end', () => {
      reader.push(null);
    });

    parser.on('error', (err) => {
      console.error(err);
      //throw err;
    });

    callback();
  }

  /**
   * Fetch data from the underlying resource.
   * @param {*} size <number> Number of bytes to read asynchronously
   */
  async _read(size) {
    // ignore size
    try {
      if (!this.parser.started)
        this.parser.parse();
      else
        this.parser.resume();
    }
    catch (err) {
      this.push(null);
    }
  }

};
