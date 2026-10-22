/**
 * A layout for one kind of device only (data-only="desktop" | "mobile", the home page's day
 * section) is removed on the other before any other system sees it, so nothing sets up animations
 * for it. Without JS the CSS hides it (styles/pages/home.css). Runs first in the registry.
 */
import { isMobile } from '../core/env';
import type { System } from '../core/registry';

function before(scope: HTMLElement) {
  const device = isMobile() ? 'mobile' : 'desktop';
  scope.querySelectorAll<HTMLElement>('[data-only]').forEach((el) => {
    if (el.dataset.only !== device) el.remove();
  });
}

export const system: System = {
  selector: '[data-only]',
  before,
  destroy: () => {},
};
