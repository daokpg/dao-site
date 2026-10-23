/**
 * Questions (home and info, components/ui/FaqList.astro). Opening one writes its answer in beside it, word by
 * word, into a row that has opened to the answer's height in one movement; closing unwinds it from the end.
 * One open at a time; when the one closing is above, it fades and then shuts in one step, the page moved by
 * the same amount in the same frame, so the question chosen stays exactly where it was. The answers ship in
 * the HTML (for no-JS); this takes them out on entry.
 */
import { gsap } from '../core/gsap';
import { E, reducedMotion } from '../core/env';
import { scrollToY } from '../core/lenis';
import { syncNav } from '../chrome/nav';
import type { System } from '../core/registry';

type State = { ac: AbortController; tls: Set<gsap.core.Timeline>; timers: number[] };
let state: State | null = null;

function destroy() {
  opener = null;
  if (!state) return;
  state.ac.abort();
  state.tls.forEach((t) => t.kill());
  state.timers.forEach(clearTimeout);
  state = null;
}

function before(scope: HTMLElement) {
  destroy();
  const ac = new AbortController();
  const me: State = (state = { ac, tls: new Set(), timers: [] });
  const items = Array.from(scope.querySelectorAll<HTMLElement>('[data-chars]'));
  const runs = new Map<HTMLElement, (open: boolean, above?: boolean) => void>();

  for (const el of items) {
    const target = el.querySelector<HTMLElement>('[data-chars-text]')!;
    const rule = el.querySelector<HTMLElement>('.rule')!;
    const btn = el.querySelector<HTMLButtonElement>('button')!;
    // the state belongs to the script: without it the answer simply stands and nothing claims otherwise
    btn.setAttribute('aria-expanded', 'false');
    if (btn.dataset.answer) btn.setAttribute('aria-controls', btn.dataset.answer);
    // what screen readers get: the answer region, there only while the question is open. Closed, it is
    // still found by the browser's find in page, which opens the question (where supported)
    const region = el.querySelector<HTMLElement>('[data-fq-answer]');
    if (region) region.setAttribute('hidden', 'until-found');
    const text = target.dataset.charsText ?? '';
    target.textContent = '';
    rule.style.boxSizing = 'border-box';
    let tl: gsap.core.Timeline | null = null;
    const track = (t: gsap.core.Timeline) => { if (tl) { tl.kill(); me.tls.delete(tl); } tl = t; me.tls.add(t); return t; };
    const padOf = (side: 'Top' | 'Bottom') => parseFloat(getComputedStyle(btn)[`padding${side}`]);
    // A word appears by its colour, from transparent to the answer's ink, a CSS transition each with its own
    // delay. Not opacity (text drawn at part opacity is rendered another way and shifts as it reaches full)
    // and not a rise (it settles by a sub-pixel as it lands): the word lies where it stays and is drawn as it
    // stays, so nothing jumps as it arrives. Returns when the last has finished.
    const fade = (words: HTMLElement[], on: boolean, dur: number, each: number, start = 0) => {
      words.forEach((w, i) => {
        w.style.transition = reducedMotion ? 'none' : `color ${dur}s ${on ? 'cubic-bezier(.33,1,.68,1)' : 'cubic-bezier(.32,0,.67,0)'} ${(start + i * each).toFixed(3)}s`;
        w.toggleAttribute('data-on', on);
      });
      return start + Math.max(0, words.length - 1) * each + dur;
    };

    const run = (open: boolean, above = false) => {
      btn.setAttribute('aria-expanded', String(open));
      if (region) { if (open) region.removeAttribute('hidden'); else region.setAttribute('hidden', 'until-found'); }
      // whatever was still moving on this row stops here
      gsap.killTweensOf(rule);
      if (open) {
        el.setAttribute('data-open', '');
        target.innerHTML = '';
        rule.style.height = '';
        const startH = rule.offsetHeight;
        // the answer arrives word by word (a few dozen plain fades, no filters: light on any phone)
        const words: HTMLElement[] = [];
        text.split(' ').forEach((w, wi, arr) => {
          const word = document.createElement('span');
          word.className = 'fq-w';
          word.textContent = w;
          target.appendChild(word);
          words.push(word);
          if (wi < arr.length - 1) target.appendChild(document.createTextNode(' '));
        });
        if (reducedMotion || !words.length) {
          fade(words, true, 0, 0);
          return;
        }
        // the row opens to the answer's full height in one movement, ahead of the words, which then write
        // themselves into the room already made (a row growing line by line read as the page shuddering)
        const fullH = rule.offsetHeight;
        rule.style.height = `${startH}px`;
        rule.style.overflow = 'hidden';
        const EACH = 0.03, DUR = 0.9;
        const t = track(gsap.timeline());
        // in whole pixels, so nothing below is ever drawn on a half pixel on the way
        t.to(rule, { height: fullH, duration: 0.55, ease: 'power3.out', snap: { height: 1 } }, 0);
        const end = fade(words, true, DUR, EACH, 0.1);
        // then the row lets go of its height, and the words of their delays (so a hover recolours them all
        // together); on the timeline, so a new choice cancels both
        t.call(() => { rule.style.height = ''; rule.style.overflow = ''; }, undefined, 0.6);
        t.call(() => words.forEach((w) => (w.style.transition = '')), undefined, end);
      } else {
        el.removeAttribute('data-open');
        const words = Array.from(target.querySelectorAll<HTMLElement>('.fq-w'));
        if (reducedMotion) { target.innerHTML = ''; return; }
        const fullH = rule.offsetHeight;
        rule.style.height = `${fullH}px`;
        rule.style.overflow = 'hidden';
        // the height of the question alone, measured on a hidden copy without the answer
        const questionOnly = () => {
          const q = rule.querySelector<HTMLElement>('.q')!;
          const clone = q.cloneNode(true) as HTMLElement;
          const ans = clone.querySelector('.ansin');
          if (ans) ans.textContent = '';
          clone.style.position = 'absolute';
          clone.style.visibility = 'hidden';
          clone.style.width = `${q.offsetWidth}px`;
          rule.appendChild(clone);
          const h = clone.offsetHeight + padOf('Top') + padOf('Bottom');
          clone.remove();
          return h;
        };
        if (above) {
          // above the question chosen: the words go, then the row shuts at once and the page moves up by
          // the same amount in that frame, so nothing below it (the question chosen) is seen to move
          const t = track(gsap.timeline());
          const gone = fade(words.slice().reverse(), false, 0.2, 0.004);
          t.call(() => {
            const before = rule.offsetHeight;
            target.innerHTML = '';
            rule.style.height = '';
            rule.style.overflow = '';
            const shrink = before - rule.offsetHeight;
            if (shrink > 0) {
              scrollToY(window.scrollY - shrink, 0);
              syncNav();
            }
          }, undefined, gone);
          return;
        }
        const t = track(gsap.timeline({ onComplete: () => { target.innerHTML = ''; rule.style.height = ''; rule.style.overflow = ''; } }));
        const gone = fade(words.slice().reverse(), false, 0.35, 0.008);
        t.to(rule, { height: questionOnly(), duration: 0.8, ease: E, snap: { height: 1 } }, 0.05);
        // the words are cleared only once the last has faded
        t.to({}, { duration: 0 }, gone);
      }
    };
    runs.set(el, run);

    // one open at a time within a list (on the info page, each topic keeps its own)
    const list = el.closest('[data-faq]');
    const openThis = () => {
      items.forEach((o) => {
        if (o !== el && o.closest('[data-faq]') === list && o.hasAttribute('data-open')) runs.get(o)?.(false, !!(o.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
      });
      run(true);
    };
    btn.addEventListener('click', () => (el.hasAttribute('data-open') ? run(false) : openThis()), { signal: ac.signal });
    region?.addEventListener('beforematch', () => { if (!el.hasAttribute('data-open')) openThis(); }, { signal: ac.signal });
  }
  opener = (id: string) => {
    const el = items.find((i) => i.id === id);
    if (!el) return false;
    if (!el.hasAttribute('data-open')) el.querySelector('button')?.click();
    return true;
  };
}

/** Opens the question named by the address (/info#cancel) once the page has landed, and goes to it. */
let opener: ((id: string) => boolean) | null = null;
function after(scope: HTMLElement) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id || !opener?.(id)) return;
  const el = scope.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
  // a frame later, after the browser's own jump to the address, so this one is the last word
  if (el) state?.timers.push(window.setTimeout(() => scrollToY(el.getBoundingClientRect().top + window.scrollY - 120, 0), 60));
}

export const system: System = {
  selector: '[data-faq]',
  before,
  after,
  destroy,
};
