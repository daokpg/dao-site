/** schema.org JSON-LD, built from content so it never drifts from what the page says. */
import type { FaqItem, SiteSettings } from '../content/types';
import { money } from './format';

// absolute addresses need the site's (astro.config.mjs `site`, from SITE_URL)
const absolute = (path: string) => new URL(path, import.meta.env.SITE).href;

export const restaurantLd = (site: SiteSettings) => ({
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: site.name,
  url: absolute('/'),
  image: absolute(site.shareImage.src),
  description: `A ${site.service.seats}-seat chef’s table on Koh Phangan led by Chef Nir Mesika. One communal table, one arrival time at ${site.service.arrival}, one fixed menu of Thai produce and Israeli and Moroccan cooking, wine pairing as the only drinks option.`,
  servesCuisine: ['Thai', 'Levantine', 'Israeli', 'Moroccan'],
  priceRange: `${money(site.pricing.menu, site.pricing.currency)} per guest`,
  address: { '@type': 'PostalAddress', addressLocality: site.contact.area, addressRegion: 'Surat Thani', addressCountry: 'TH' },
  email: site.contact.email,
  telephone: site.contact.phone,
  founder: { '@type': 'Person', name: 'Nir Mesika' },
  acceptsReservations: true,
  maximumAttendeeCapacity: site.service.seats,
  // one arrival time; when the evening ends is not fixed, so no closing time is given
  openingHoursSpecification: [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: site.service.days.map((day) => `https://schema.org/${day}`),
    opens: site.service.arrival,
  }],
});

export const faqLd = (items: FaqItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answer } })),
});
