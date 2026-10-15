/**
 * The home page's day section: keep the version chosen with ?trail=… (remembered for the visit,
 * read into <html data-trail> by an inline script in Base.astro; Rows unless the spine is asked
 * for) and remove the other before any other system sees it. Inside it, a layout for one kind of
 * device only (data-only="desktop" | "mobile") is removed on the other, so nothing sets up
 * animations for it. Runs first in the registry. Delete with the spine once it is decided.
 */
import { isMobile } from '../core/env';
import type { System } from '../core/registry';

const TRAIL_OPTIONS = ['rows', 'spine'] as const;

function before(scope: HTMLElement) {
  const want = document.documentElement.dataset.trail;
  const chosen = TRAIL_OPTIONS.includes(want as (typeof TRAIL_OPTIONS)[number]) ? want : 'rows';
  scope.querySelectorAll<HTMLElement>('[data-trail-variant]').forEach((el) => {
    if (el.dataset.trailVariant !== chosen) el.remove();
  });
  const device = isMobile() ? 'mobile' : 'desktop';
  scope.querySelectorAll<HTMLElement>('[data-trail-variant] [data-only]').forEach((el) => {
    if (el.dataset.only !== device) el.remove();
  });
}

export const system: System = {
  selector: '[data-trail-variant]',
  before,
  destroy: () => {},
};
