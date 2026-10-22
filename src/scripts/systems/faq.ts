/**
 * Questions (home and info, components/ui/FaqList.astro). Opening one writes its answer in beside it, word by
 * word (a fade and a small rise, no blur: per-character blur was too heavy for phones and Safari), while the row
 * grows with the text as it lands; closing unwinds it from the end. One open
 * at a time. The answers ship in the HTML (for no-JS); this takes them out on entry.
 */
import { gsap } from '../core/gsap';
import { E, reducedMotion } from '../core/env';
import { scrollToY } from '../core/lenis';
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
  const runs = new Map<HTMLElement, (open: boolean) => void>();

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

    const run = (open: boolean) => {
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
          track(gsap.timeline()).set(words, { opacity: 1, y: 0 });
          return;
        }
        // where each word ends, measured once now; the row grows to each as it lands, without measuring again
        const fullH = rule.offsetHeight;
        const top = rule.getBoundingClientRect().top;
        const pad = padOf('Bottom');
        const ends = words.map((w) => Math.round(Math.min(fullH, Math.max(startH, w.getBoundingClientRect().bottom - top + pad))));
        rule.style.height = `${startH}px`;
        rule.style.overflow = 'hidden';
        const hTo = gsap.quickTo(rule, 'height', { duration: 0.7, ease: E });
        const EACH = 0.03, DUR = 0.9;
        let shown = startH;
        const t = track(gsap.timeline());
        t.to(words, { opacity: 1, y: 0, duration: DUR, ease: E, stagger: { each: EACH } }, 0);
        // a word counts as landed halfway through its fade
        t.to({}, {
          duration: words.length * EACH + DUR, ease: 'none',
          onUpdate() {
            const i = Math.min(words.length - 1, Math.floor((this.time() - DUR / 2) / EACH));
            if (i >= 0 && ends[i] > shown) { shown = ends[i]; hTo(shown); }
          },
        }, 0);
        // the full height, then the row lets go of it (on the timeline, so a new choice cancels both)
        t.call(() => hTo(fullH));
        t.call(() => { rule.style.height = ''; rule.style.overflow = ''; }, undefined, '+=0.75');
      } else {
        el.removeAttribute('data-open');
        const words = Array.from(target.querySelectorAll('.fq-w'));
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
        const t = track(gsap.timeline({ onComplete: () => { target.innerHTML = ''; rule.style.height = ''; rule.style.overflow = ''; } }));
        t.to(words.slice().reverse(), { opacity: 0, duration: 0.35, ease: E, stagger: { each: 0.008 } }, 0);
        t.to(rule, { height: questionOnly(), duration: 0.8, ease: E }, 0.05);
      }
    };
    runs.set(el, run);

    // one open at a time within a list (on the info page, each topic keeps its own)
    const list = el.closest('[data-faq]');
    const openThis = () => {
      items.forEach((o) => { if (o !== el && o.closest('[data-faq]') === list && o.hasAttribute('data-open')) runs.get(o)?.(false); });
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
