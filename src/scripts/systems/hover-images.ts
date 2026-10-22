/**
 * The rows that open on hover to show a photograph (the evening facts, the story's route). The
 * photographs are only ever seen under the pointer, so they are rendered without their files and
 * fetched the first time the pointer comes into the list. Phones never show them.
 */
import { isMobile } from '../core/env';
import { loadDeferred } from '../core/defer';
import type { System } from '../core/registry';

let ac: AbortController | null = null;

function destroy() {
  ac?.abort();
  ac = null;
}

function before(scope: HTMLElement) {
  destroy();
  if (isMobile()) return;
  ac = new AbortController();
  scope.querySelectorAll<HTMLElement>('[data-hover-images]').forEach((list) => {
    list.addEventListener('pointerenter', () => loadDeferred(list), { once: true, signal: ac!.signal });
  });
}

export const system: System = {
  selector: '[data-hover-images]',
  before,
  destroy,
};
