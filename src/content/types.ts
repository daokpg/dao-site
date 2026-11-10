/**
 * Content shapes. Every editable block on the site is one of these.
 *
 * These are written to map one-to-one onto Sanity documents later: a page is a
 * document, each section is an object field on it, lists are arrays. When Sanity is
 * connected, src/lib/content.ts fetches documents of these shapes instead of importing
 * the local files, and no component has to change.
 */

export interface Image {
  src: string;
  /** Empty string for purely decorative frames. */
  alt: string;
  /** CSS object-position, e.g. "35% 50%". The crop is part of the content. */
  position?: string;
}

export interface Seo {
  title: string;
  description: string;
}

export interface Cta {
  label: string;
  href: string;
}

export interface PageLink {
  key: PageKey;
  label: string;
  /** Two-digit index shown beside the name in the menu and footer. */
  num: string;
  href: string;
  image: Image;
}

export type PageKey = 'home' | 'story' | 'evening' | 'reserve' | 'info';

/** A page reached only by links in the page (not listed in the menu or footer). */
export interface UnlistedPage {
  key: PageKey;
  /** The name the page transition shows on the way there. */
  label: string;
  href: string;
}

export interface PressOutlet {
  name: string;
  logo: string;
  /** Intrinsic logo box in px, so every mark sits at its drawn size. */
  width: number;
  height: number;
  years: string;
}

export interface FaqItem {
  /** Stable slug, so other pages can pick a question (the home page shows a few of the info page's). */
  id: string;
  question: string;
  /** May hold {tokens} for prices ({menu}, {pairingFour}, {pairingFive}, {noShowFee}, {cake}), filled from site.pricing. */
  answer: string;
}

export interface Pricing {
  currency: string;
  menu: number;
  pairingFour: number;
  pairingFive: number;
  /**
   * Nothing is paid at booking. From `cardFrom` seats a card is saved with Stripe, and charged this
   * much per missing guest only for a no-show or a cancellation on the day. The team charges it by
   * setting the inbox status to Late Cancel or No Show (and Missing guests, if only some didn't come). Keep in step with backend/booking.gs.
   */
  noShowFee: number;
  /** Bookings of this many seats or more save a card. Keep in step with backend/booking.gs (CARD_FROM_SEATS). */
  cardFrom: number;
  /** A birthday cake, offered when the occasion is a birthday. Paid on the night. */
  cake: number;
}

export interface SiteSettings {
  name: string;
  /** The corner label in the nav. */
  place: string;
  /** Shown letter by letter under the mark in the intro. */
  tagline: string;
  contact: {
    email: string;
    phone: string;
    address: string;
    area: string;
  };
  copyright: string;
  /** The evening's facts the copy repeats: read from here, written once. */
  service: {
    /** Everyone arrives at this time ("19:30"). */
    arrival: string;
    /** Seats at the one table (Saturdays have fewer; the booking backend sends each night's). */
    seats: number;
    /** The nights the restaurant opens, as English weekday names ("Monday"); read by the structured data. */
    days: string[];
  };
  pricing: Pricing;
  /** The picture shown when a page is shared (link previews): 1200x630, made by tools/share-images.mjs. */
  shareImage: Image & { width: number; height: number };
  /** The page for an address that does not exist. */
  notFound: { seo: Seo; heading: string; text: string };
  /** The menu and footer list these, in this order. */
  pages: PageLink[];
  /** Pages outside the menu and footer, reached from a link in the page (the info page). */
  unlisted: UnlistedPage[];
  press: PressOutlet[];
  labels: {
    menu: string;
    close: string;
    reserve: string;
    /** The first thing the keyboard reaches: jumps past the nav to the page. */
    skip: string;
  };
}
