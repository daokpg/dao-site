/**
 * JSON to put inside a <script> tag (page data, JSON-LD). `<` and the two line separators (U+2028,
 * U+2029) are escaped, so no content (once it comes from a CMS) can close the tag and start a
 * script of its own.
 */
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);

export const scriptJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
