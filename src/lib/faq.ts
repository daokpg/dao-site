/** FAQ answers hold {tokens} for prices; these fill them from the site's pricing, so the two never drift. */
import type { FaqItem, SiteSettings } from '../content/types';
import { fill, money } from './format';

export const fillAnswers = (items: FaqItem[], site: SiteSettings): FaqItem[] => {
  const { currency, ...amounts } = site.pricing;
  const values = Object.fromEntries(Object.entries(amounts).map(([k, v]) => [k, money(v, currency)]));
  return items.map((item) => ({ ...item, answer: fill(item.answer, values) }));
};
