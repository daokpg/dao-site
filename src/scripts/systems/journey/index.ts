/**
 * The home page's day section (components/home/journey). Only one version is in the page
 * (systems/trail-variant.ts), so at most one of these starts.
 *
 *   [data-rows]   in use: two full-width rows held on screen, carried sideways by the scroll (phones: two columns)
 *   [data-spine]  the alternative (?trail=spine): a column bending along a wave as it passes (phones: a swiped row)
 *
 * On desktop both end by carrying a photograph into the evening section (./handoff.ts).
 */
import { gsap } from '../../core/gsap';
import type { System } from '../../core/registry';
import type { State } from './shared';
import { spine } from './spine';
import { rows } from './rows';

let state: State | null = null;

function destroy() {
  if (!state) return;
  state.cleanups.forEach((fn) => fn());
  gsap.killTweensOf(state.tweened);
  state = null;
}

const options: [string, (section: HTMLElement, me: State, scope: HTMLElement) => void][] = [
  ['[data-spine]', spine],
  ['[data-rows]', rows],
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
