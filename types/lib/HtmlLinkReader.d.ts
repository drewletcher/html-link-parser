export default class HtmlLinkReader {
    /**
     *
     * @param {Object}      options
     * @param {URL|String}  options.url
     * @param {Uint8Array|String} options.data
     */
    constructor(options: {
        url: URL | string;
        data: Uint8Array | string;
    });
    options: {
        url: URL | string;
        data: Uint8Array | string;
    };
    _construct(callback: any): Promise<void>;
    parser: HtmlLinkParser | undefined;
    /**
     * Fetch data from the underlying resource.
     * @param {*} size <number> Number of bytes to read asynchronously
     */
    _read(size: any): Promise<void>;
}
import HtmlLinkParser from "./HtmlLinkParser.js";
//# sourceMappingURL=HtmlLinkReader.d.ts.map