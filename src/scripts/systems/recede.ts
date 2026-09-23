/**
 * A pinned panel that holds still, scales back, drifts down and dims while the next sheet
 * slides over it. Markup:
 *
 *   <section data-recede-panel="[data-sheet]" data-recede-scale="0.88" data-recede-y="24">
 *     … <span data-recede-dim></span>
 *   </section>
 *
 * The attribute's value is the selector of the sheet that covers it.
 */
import { gsap } from '../core/gsap';
import { reducedMotion } from '../core/env';
import type { System } from '../core/registry';

function after(scope: HTMLElement) {
  if (reducedMotion) return;
  scope.querySelectorAll<HTMLElement>('[data-recede-panel]').forEach((panel) => {
    const under = scope.querySelector(panel.dataset.recedePanel || '');
    if (!under) return;
    gsap.timeline({ scrollTrigger: { trigger: under, start: 'top bottom', end: 'top top', scrub: true } })
      .to(panel, { scale: Number(panel.dataset.recedeScale ?? 0.88), y: Number(panel.dataset.recedeY ?? 24), ease: 'none' }, 0)
      .to(panel.querySelector('[data-recede-dim]'), { opacity: 0.6, ease: 'none' }, 0);
  });
}

export const system: System = {
  selector: '[data-recede-panel]',
  after,
  destroy: () => {},
};
