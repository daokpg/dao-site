/**
 * The info page's topic index: choosing a topic glides there (through Lenis, core/lenis.ts) and
 * moves focus to its heading. Without JS the links are plain anchors. Barba leaves them alone
 * (data-barba-prevent).
 */
import { scrollToY } from '../core/lenis';
import type { System } from '../core/registry';

let ac: AbortController | null = null;

function destroy() {
  ac?.abort();
  ac = null;
}

function before(scope: HTMLElement) {
  destroy();
  ac = new AbortController();
  scope.querySelectorAll<HTMLAnchorElement>('[data-info-jump]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = scope.querySelector<HTMLElement>(a.hash);
      if (!target) return;
      e.preventDefault();
      scrollToY(target.getBoundingClientRect().top + window.scrollY - 40);
      history.replaceState(history.state, '', a.hash);
      const heading = target.querySelector<HTMLElement>('h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }, { signal: ac!.signal });
  });
}

export const system: System = {
  selector: '[data-info-jump]',
  before,
  destroy,
};
