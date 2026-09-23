/** "THB 3,900". Used on the server and in the browser, so it stays dependency-free. */
export const money = (amount: number, currency = 'THB') =>
  `${currency} ${Math.round(amount).toLocaleString('en-US')}`;

/** Fill {token}s in a content sentence. Unknown tokens are left as written. */
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
