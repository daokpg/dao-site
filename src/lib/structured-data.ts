/** schema.org JSON-LD, built from content so it never drifts from what the page says. */
import type { FaqItem, SiteSettings } from '../content/types';
import { money } from './format';

export const restaurantLd = (site: SiteSettings) => ({
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: site.name,
  description: 'A sixteen-seat chef’s table on Koh Phangan led by Chef Nir Mesika. One communal table, one arrival time at 19:30, one fixed menu of Thai produce and Israeli and Moroccan cooking, wine pairing as the only drinks option.',
  servesCuisine: ['Thai', 'Levantine', 'Israeli', 'Moroccan'],
  priceRange: `${money(site.pricing.menu, site.pricing.currency)} per guest`,
  address: { '@type': 'PostalAddress', addressLocality: 'Sri Thanu, Koh Phangan', addressRegion: 'Surat Thani', addressCountry: 'TH' },
  email: site.contact.email,
  founder: { '@type': 'Person', name: 'Nir Mesika' },
  acceptsReservations: 'True',
  maximumAttendeeCapacity: 16,
});

export const faqLd = (items: FaqItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answer } })),
});
