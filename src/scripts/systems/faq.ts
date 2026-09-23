/**
 * FAQ (home). Opening a question writes its answer in beside it, character by character,
 * while the row grows with the text as it lands; closing unwinds it from the end. One open
 * at a time. The answers ship in the HTML (for no-JS); this takes them out on entry.
 */
import { gsap } from '../core/gsap';
import { E, reducedMotion } from '../core/env';
import type { System } from '../core/registry';

type State = { ac: AbortController; tls: Set<gsap.core.Timeline>; timers: number[] };
let state: State | null = null;

function destroy() {
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
    const text = target.dataset.charsText ?? '';
    target.textContent = '';
    rule.style.boxSizing = 'border-box';
    let tl: gsap.core.Timeline | null = null;
    const track = (t: gsap.core.Timeline) => { if (tl) { tl.kill(); me.tls.delete(tl); } tl = t; me.tls.add(t); return t; };
    const padOf = (side: 'Top' | 'Bottom') => parseFloat(getComputedStyle(btn)[`padding${side}`]);

    const run = (open: boolean) => {
      btn.setAttribute('aria-expanded', String(open));
      if (open) {
        el.setAttribute('data-open', '');
        el.classList.remove('closing');
        target.innerHTML = '';
        rule.style.height = '';
        const startH = rule.offsetHeight;
        // words hold the characters, so the line breaks only at spaces
        const chars: HTMLElement[] = [];
        text.split(' ').forEach((w, wi, arr) => {
          const word = document.createElement('span');
          word.style.cssText = 'display:inline-block;white-space:nowrap';
          for (const c of Array.from(w)) {
            const s = document.createElement('span');
            s.className = 'fq-ch';
            s.textContent = c;
            word.appendChild(s);
            chars.push(s);
          }
          target.appendChild(word);
          if (wi < arr.length - 1) target.appendChild(document.createTextNode(' '));
        });
        if (reducedMotion) {
          track(gsap.timeline()).set(chars, { opacity: 1, filter: 'none' });
          return;
        }
        // measure the full height, then let the row grow with the text as the characters land
        const fullH = rule.offsetHeight;
        rule.style.height = `${startH}px`;
        rule.style.overflow = 'hidden';
        let targetH = startH;
        const hTo = gsap.quickTo(rule, 'height', { duration: 0.7, ease: E });
        const grow = () => {
          let lastC = chars[0];
          for (const c of chars) { if (Number(gsap.getProperty(c, 'opacity')) >= 0.5) lastC = c; else break; }
          const bottom = lastC.getBoundingClientRect().bottom - rule.getBoundingClientRect().top + padOf('Bottom');
          const want = Math.round(Math.max(startH, Math.min(fullH, bottom)));
          if (want > targetH) { targetH = want; hTo(want); }
        };
        const t = track(gsap.timeline({
          onComplete: () => {
            hTo(fullH);
            me.timers.push(window.setTimeout(() => { rule.style.height = ''; rule.style.overflow = ''; }, 750));
          },
        }));
        t.to(chars, { opacity: 1, filter: 'blur(0px)', duration: 1.4, ease: E, stagger: { each: 0.005 } }, 0);
        t.to(rule, { duration: chars.length * 0.005 + 1.4, ease: 'none', onUpdate: grow }, 0);
      } else {
        el.removeAttribute('data-open');
        el.classList.remove('closing');
        void el.offsetWidth;
        el.classList.add('closing');
        const chars = Array.from(target.querySelectorAll('.fq-ch'));
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
        t.to(chars.slice().reverse(), { opacity: 0, filter: 'blur(5px)', duration: 0.4, ease: E, stagger: { each: 0.003 } }, 0);
        t.to(rule, { height: questionOnly(), duration: 0.8, ease: E }, 0.05);
      }
    };
    runs.set(el, run);

    btn.addEventListener('click', () => {
      const open = !el.hasAttribute('data-open');
      if (open) items.forEach((o) => { if (o !== el && o.hasAttribute('data-open')) runs.get(o)?.(false); });
      run(open);
    }, { signal: ac.signal });
  }
}

export const system: System = {
  selector: '[data-faq]',
  before,
  destroy,
};
