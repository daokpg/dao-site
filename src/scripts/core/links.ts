/**
 * A link to the page you are already on does not transition: it closes the menu if it is
 * open and glides back to the top. Runs in the capture phase, ahead of Barba.
 */
import { scrollToTop } from './lenis';
import { closeMenu, isMenuOpen } from '../chrome/menu';

/** A path as the site names it: no .html, no trailing slash ('/story.html' and '/story/' are '/story'). */
export const cleanPath = (path: string) => path.replace(/(\/index)?\.html$/, '').replace(/\/$/, '') || '/';

export function initSamePageLinks() {
  window.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.hash || cleanPath(url.pathname) !== cleanPath(location.pathname)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (isMenuOpen()) closeMenu();
    scrollToTop({ duration: 1.6 });
  }, true);
}
