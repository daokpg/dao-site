/** "THB 3,900". Used on the server and in the browser, so it stays dependency-free. */
export const money = (amount: number, currency = 'THB') =>
  `${currency} ${Math.round(amount).toLocaleString('en-US')}`;

/** Fill {token}s in a content sentence. Unknown tokens are left as written. */
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

/** A count or an index in two digits: "07", "12". */
export const pad2 = (n: number) => String(n).padStart(2, '0');

/** An image's crop (content's Image.position) as an inline style; nothing for the default centre. */
export const cropStyle = (position?: string) => (position ? `object-position:${position}` : undefined);
