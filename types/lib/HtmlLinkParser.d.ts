export default class HtmlLinkParser {
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
    constructor(options?: {
        url?: string | URL | undefined;
        data?: string | Uint8Array<ArrayBufferLike> | undefined;
        rs?: any;
        heading?: string | RegExp | undefined;
        terms?: (string | RegExp)[] | undefined;
        attributes?: string[] | undefined;
    });
    options: {
        tags: string[];
        attributes: string[];
        terms: never[];
        trim: boolean;
    } & {
        url?: string | URL | undefined;
        data?: string | Uint8Array<ArrayBufferLike> | undefined;
        rs?: Readable;
        heading?: string | RegExp | undefined;
        terms?: (string | RegExp)[] | undefined;
        attributes?: string[] | undefined;
    };
    saxOptions: {
        trim: boolean;
    };
    started: boolean;
    paused: boolean;
    cancelled: boolean;
    links: any[];
    count: number;
    /**
     * Load and parse the HTML document.
     * @returns an array of link objects.
     * If using an event listener the return value will be an empty array.
     */
    parse(): Promise<any[] | undefined>;
    saxStream: any;
    pause(): void;
    resume(): void;
    cancel(): void;
    /**
     * Emits or appends data to links array.
     *
     * @param {*} link is an object with href and text properties.
     */
    push(link: any): Promise<void>;
}
//# sourceMappingURL=HtmlLinkParser.d.ts.map