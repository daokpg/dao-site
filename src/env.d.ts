/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** The booking backend: the Apps Script web app inside the reservations sheet (docs/booking.md). Empty runs /reserve on placeholder nights. */
  readonly PUBLIC_BOOKING_API?: string;
  /** "true" once the real domain is live: lets search engines in (robots.txt, no noindex). */
  readonly INDEXABLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
