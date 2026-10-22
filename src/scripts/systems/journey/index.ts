/**
 * The home page's day section, the spine (components/home/journey/SpineJourney.astro): a column
 * bending along a wave as it passes, ending by carrying its last photograph into the evening section
 * (./handoff.ts). Phones: a swiped row (./spine-mobile.ts).
 */
import { gsap } from '../../core/gsap';
import type { System } from '../../core/registry';
import type { State } from './shared';
import { spine } from './spine';

let state: State | null = null;

function destroy() {
  if (!state) return;
  state.cleanups.forEach((fn) => fn());
  gsap.killTweensOf(state.tweened);
  state = null;
}

const options: [string, (section: HTMLElement, me: State, scope: HTMLElement) => void][] = [
  ['[data-spine]', spine],
];

function after(scope: HTMLElement) {
  destroy();
  const me: State = (state = { tweened: [], cleanups: [] });
  for (const [sel, start] of options) scope.querySelectorAll<HTMLElement>(sel).forEach((s) => start(s, me, scope));
}

export const system: System = {
  selector: options.map(([sel]) => sel).join(', '),
  after,
  destroy,
};
