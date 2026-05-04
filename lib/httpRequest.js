// lib/httpRequest
"use strict";

import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import zlib from 'node:zlib';

/**
 * httpRequest
 * Takes some Axios style request config options.
 * These request options are converted to Node.js options for HTTP, HTTPS, HTTP/2
 *
 * @param {URL|String} url The absolute or relative input URL to options.
 * @param {Object} options HTTP options parameters.
 * @param {String} [options.base] URL to use as base for requests if url is relative.
 * @param {Object} [options.params] object containing URL querystring parameters.
 * @param {String} [options.httpVersion] HTTP version to use 1.0, 1.1, 2
 * @param {String} [options.method] HTTP options method, default is GET
 * @param {Number} [options.timeout] options timeout ms, default 5000ms
 * @param {Object} [options.headers] HTTP options headers
 * @param {Array}  [request.cookies] array of strings, e.g. response.headers['set-cookie'] from previous call
 * @param {String} [options.auth] Basic authentication i.e. 'user:password' to compute an Authorization header.
 * @param {String} [options.responseType] If set to 'stream' the response will be returned when headers are received.
 * @param {Uint8Array|String} [data]
 * @returns
 */
export default function httpRequest(url, options, data) {

  if (typeof url === "undefined")
    url = '';

  let Url;
  if (typeof url === "string") {
    Url = new URL(url, options.base);
  }
  else if (typeof url === "object" && url instanceof URL)
    Url = url;
  else {
    throw new StorageError(`Invalid url ${url}`);
  }

  if (options.params) {
    for (const [ name, value ] of Object.entries(options.params))
      Url.searchParams.append(name, value);
  }

  if (options.httpVersion === 2)
    return http2Request(Url, options, data);
  else
    return http1Request(Url, options, data);
}

/**
 * Create an object mode readstream from the URL.
 * @param {String} url Override smt.schema with a filename in the same locus.
 * @param {Object} options http request options, see httpRequest
 * @returns a node.js readstream if successful.
*/
export async function createReadStream(url, options) {
  console.debug("createReadStream");

  try {
    let request = Object.assign({
      responseType: "stream"
    }, options);

    // create read stream
    let rs = await httpRequest(url, request);

    ///// check for zip
    if (url.endsWith('.gz')) {
      var decoder = zlib.createGunzip({ flush: zlib.constants.Z_PARTIAL_FLUSH });
      rs.pipe(decoder);
      return decoder;
    }
    else
      return rs;
  }
  catch (err) {
    console.warn(err);
    throw err;
  }
}

/**
 *
 * @param {*} Url
 * @param {*} request
 * @param {*} data
 * @returns
 */
function http1Request(Url, options, data) {
  return new Promise((resolve, reject) => {
    let response = {
      data: ""
    };

    var request = {};
    request.method = options.method?.toUpperCase() || "GET";
    request.timeout = options.timeout || 5000;
    request.headers = Object.assign({}, options.headers);
    if (options.cookies)
      options.headers[ "Cookie" ] = Object.entries(request.cookies).join('; ');
    if (options.auth)
      request[ "auth" ] = options.auth;

    if (data) {
      // check for web form data
      if (request.headers[ "Content-Type" ] === "application/x-www-form-urlencoded" && typeof data === "object") {
        data = (new URLSearchParams(data)).toString();
      }

      // default to json payload
      if (!request.headers[ 'Content-Type' ])
        request.headers[ "Content-Type" ] = "application/json; charset=utf-8";

      // request.headers['Content-Length'] = Buffer.byteLength(data);
      // if Content-Length is not set then default is chunked encoding
    }

    let _http = (Url.protocol === "https:") ? https : http;

    const req = _http.request(Url, request, (res) => {
      response.httpVersion = res.httpVersion;
      response.statusCode = res.statusCode;
      response.statusMessage = res.statusMessage;
      response.headers = res.headers;

      if (options.responseType !== 'stream') {
        // return response body
        var chunks = [];

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          var buffer = Buffer.concat(chunks);

          let encoding = response.headers[ "content-encoding" ];
          if (encoding) {
            if (encoding === 'gzip')
              response.data = zlib.gunzipSync(buffer).toString();
            else if (encoding === 'deflate')
              response.data = zlib.deflateSync(buffer).toString();
            else if (encoding === 'br')
              response.data = zlib.brotliDecompressSync(buffer).toString();
            else
              throw new StorageError(`unkonwn content-encoding: ${encoding}`);
          }
          else {
            // otherwise assume text
            response.data = buffer.toString();
            //console.debug(`\n${response.data}`);
          }

          resolve(response);
        });
      }
    });

    if (options.responseType === 'stream') {
      // return a read stream

      req.on('response', (rs) => {
        ///// check for zip
        let decoder;
        if (rs.headers[ "content-encoding" ] === 'gzip')
          decoder = zlib.createGunzip({ flush: zlib.constants.Z_PARTIAL_FLUSH });
        else if (rs.headers[ "content-encoding" ] === 'deflate')
          decoder = zlib.createDeflate();
        else if (rs.headers[ "content-encoding" ] === 'br')
          decoder = zlib.createBrotliDecompress();

        if (decoder) {
          rs.pipe(decoder);
          resolve(decoder);
        }
        else
          resolve(rs);
      });
    }

    req.on('error', (err) => {
      console.warn(err.message);
      reject(err);
    });

    // stream the request data
    if (data)
      req.write(data);

    // end of request (flush send buffer)
    req.end();
  });
}

/**
 * !!! this is probably broken !!!
 * @param {*} Url
 * @param {*} request
 * @param {*} data
 * @returns
 */
function http2Request(Url, options, data) {
  return new Promise((resolve, reject) => {
    let response = {};

    const client = http2.connect(Url);

    client.on('error', (err) => {
      console.warn(err.message);
      reject(err);
    });

    let request = Object.assign({
      ':method': options.method || 'GET',
      ':path': Url.path || ''
    }, options.headers);

    if (options.cookies)
      options[ "cookie" ] = Object.entries(request.cookies).join('; ');
    if (options.auth)
      request[ "auth" ] = options.auth;
    if (options.params)
      request[ "params" ] = options.params;

    const req = client.request(request);

    req.setEncoding('utf8');
    if (data)
      req.write(data);
    req.end();

    req.on('response', (headers, flags) => {
      response.headers = headers;
    });

    req.on('data', (chunk) => {
      response.data += chunk;
    });

    req.on('end', () => {
      //console.debug(`\n${response.data}`);
      client.close();
      resolve(response);
    });

  });
}

httpRequest.createReadStream = createReadStream;
