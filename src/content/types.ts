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

export type PageKey = 'home' | 'story' | 'evening' | 'reserve';

export interface PressOutlet {
  name: string;
  logo: string;
  /** Intrinsic logo box in px, so every mark sits at its drawn size. */
  width: number;
  height: number;
  years: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface Pricing {
  currency: string;
  menu: number;
  pairingFour: number;
  pairingFive: number;
  /**
   * Nothing is paid at booking: a card is saved with Stripe to hold the seats, and charged this
   * much per seat only for a no-show or a cancellation inside 48 hours.
   */
  noShowFee: number;
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
  pricing: Pricing;
  pages: PageLink[];
  press: PressOutlet[];
  labels: {
    menu: string;
    close: string;
    reserve: string;
  };
}
