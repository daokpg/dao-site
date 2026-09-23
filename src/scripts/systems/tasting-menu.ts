/**
 * The past menu on the evening page. "Read it as" swaps the two cooked courses between
 * meat & fish and fish: the text fades through blur while the row's height eases to the
 * new wording, so nothing under it jumps. The pairing choice marks which courses carry a
 * glass (four covers the boat through the main, five adds the sweet) and counts the
 * evening's total to its new figure.
 */
import { gsap } from '../core/gsap';
import { E } from '../core/env';
import { money } from '../../lib/format';
import type { System } from '../core/registry';

type Pairing = 0 | 4 | 5;
/** Which courses carry a glass, by course index. */
const GLASSES: Record<Pairing, number[]> = { 0: [], 4: [1, 2, 3, 4], 5: [1, 2, 3, 4, 5] };

type State = { ac: AbortController; els: object[] };
let state: State | null = null;

function destroy() {
  if (!state) return;
  state.ac.abort();
  gsap.killTweensOf(state.els);
  state = null;
}

function before(scope: HTMLElement) {
  destroy();
  const ac = new AbortController();
  const descs = Array.from(scope.querySelectorAll<HTMLElement>('[data-course-desc]'));
  const glasses = Array.from(scope.querySelectorAll<HTMLElement>('[data-course-glass]'));
  const total = scope.querySelector<HTMLElement>('[data-total]')!;
  const tot = { v: Number(total.dataset.menuPrice) };
  state = { ac, els: [...descs, ...descs.map((d) => d.closest('.course')!), tot] };
  let menu: 'meat' | 'fish' = 'meat';
  let pairing: Pairing = 0;

  const press = (attr: string, value: string) =>
    scope.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));

  const setMenu = (m: 'meat' | 'fish') => {
    if (m === menu) return;
    menu = m;
    press('data-pick-menu', m);
    const els = descs.filter((d) => d.dataset.meat && d.dataset.fish);
    const rows = els.map((el) => el.closest<HTMLElement>('.course')!);
    const h0 = rows.map((r) => r.offsetHeight);
    rows.forEach((r, i) => { r.style.height = `${h0[i]}px`; r.style.overflow = 'hidden'; r.style.boxSizing = 'border-box'; });
    gsap.to(els, {
      opacity: 0, filter: 'blur(6px)', duration: 0.35, ease: 'power2.in',
      onComplete: () => {
        els.forEach((el) => (el.textContent = el.dataset[m] ?? ''));
        rows.forEach((r, i) => {
          r.style.height = 'auto';
          const h1 = r.offsetHeight;
          r.style.height = `${h0[i]}px`;
          gsap.to(r, { height: h1, duration: 1.1, ease: E, onComplete: () => { r.style.height = ''; r.style.overflow = ''; } });
        });
        gsap.fromTo(els, { opacity: 0, filter: 'blur(6px)', y: 6 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.1, ease: E, stagger: 0.08 });
      },
    });
  };

  const setPairing = (p: Pairing) => {
    if (p === pairing) return;
    pairing = p;
    press('data-pick-pairing', String(p));
    const on = GLASSES[p];
    const label = total.dataset.glassLabel ?? 'Glass';
    glasses.forEach((g, i) => {
      const n = on.indexOf(i);
      g.dataset.on = String(n >= 0);
      g.textContent = n >= 0 ? `${label} ${n + 1}` : label;
    });
    const to = Number(total.dataset.menuPrice) + (p === 4 ? Number(total.dataset.four) : p === 5 ? Number(total.dataset.five) : 0);
    gsap.to(tot, { v: to, duration: 1.4, ease: E, onUpdate: () => { total.textContent = money(tot.v, total.dataset.currency); } });
  };

  scope.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-pick-menu], [data-pick-pairing]');
    if (!b) return;
    if (b.dataset.pickMenu) setMenu(b.dataset.pickMenu as 'meat' | 'fish');
    else setPairing(Number(b.dataset.pickPairing) as Pairing);
  }, { signal: ac.signal });
}

export const system: System = {
  selector: '[data-courses]',
  before,
  destroy,
};
