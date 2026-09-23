/**
 * The nav reads cream over the hero photograph and turns to ink once the paper sheet
 * marked data-tone-flip has slid up under it.
 */
import { ScrollTrigger } from '../core/gsap';
import { setTone } from '../core/tone';
import type { System } from '../core/registry';

function before(scope: HTMLElement) {
  const sheet = scope.querySelector('[data-tone-flip]');
  if (!sheet) return;
  ScrollTrigger.create({
    trigger: sheet,
    start: 'top 80px',
    onEnter: () => setTone('page', false),
    onLeaveBack: () => setTone('page', true),
  });
}

export const system: System = {
  selector: '[data-tone-flip]',
  before,
  // its only trigger dies with the rest on leave
  destroy: () => {},
};
