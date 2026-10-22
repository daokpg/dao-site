/**
 * The past menu on the evening page. "Read it as" swaps the two cooked courses between
 * meat & fish and fish: the text fades through blur while the row's height eases to the
 * new wording, so nothing under it jumps. The pairing choice marks which courses carry a
 * glass (each course says which pairing first pours with it, content/evening.ts) and counts the
 * evening's total to its new figure, read out once it lands. A choice made while the last one is
 * still moving takes over from it.
 */
import { gsap } from '../core/gsap';
import { E } from '../core/env';
import { money } from '../../lib/format';
import type { System } from '../core/registry';

type Pairing = 0 | 4 | 5;

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
  const say = scope.querySelector<HTMLElement>('[data-total-say]');
  const label = glasses[0]?.textContent ?? '';
  const tot = { v: Number(total.dataset.menuPrice) };
  state = { ac, els: [...descs, ...descs.map((d) => d.closest('.course')!), tot] };
  let turn = 0;
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
    // a second choice mid-way: stop the first where it is and go on from there
    const mine = ++turn;
    gsap.killTweensOf([...els, ...rows]);
    const h0 = rows.map((r) => r.offsetHeight);
    rows.forEach((r, i) => { r.style.height = `${h0[i]}px`; r.style.overflow = 'hidden'; r.style.boxSizing = 'border-box'; });
    gsap.to(els, {
      opacity: 0, filter: 'blur(6px)', duration: 0.35, ease: 'power2.in',
      onComplete: () => {
        if (mine !== turn) return;
        els.forEach((el) => (el.textContent = el.dataset[m] ?? ''));
        rows.forEach((r, i) => {
          r.style.height = 'auto';
          const h1 = r.offsetHeight;
          r.style.height = `${h0[i]}px`;
          gsap.to(r, { height: h1, duration: 1.1, ease: E, onComplete: () => { if (mine !== turn) return; r.style.height = ''; r.style.overflow = ''; } });
        });
        gsap.fromTo(els, { opacity: 0, filter: 'blur(6px)', y: 6 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.1, ease: E, stagger: 0.08 });
      },
    });
  };

  const setPairing = (p: Pairing) => {
    if (p === pairing) return;
    pairing = p;
    press('data-pick-pairing', String(p));
    // glasses are numbered in the order they are poured; one turning off keeps its number while it fades
    let n = 0;
    glasses.forEach((g) => {
      const on = !!p && Number(g.dataset.glass || 99) <= p;
      g.dataset.on = String(on);
      if (on) g.textContent = `${label} ${++n}`;
    });
    const to = Number(total.dataset.menuPrice) + (p === 4 ? Number(total.dataset.four) : p === 5 ? Number(total.dataset.five) : 0);
    const choice = scope.querySelector(`[data-pick-pairing="${p}"]`)?.textContent ?? '';
    gsap.to(tot, {
      v: to, duration: 1.4, ease: E, overwrite: true,
      onUpdate: () => { total.textContent = money(tot.v, total.dataset.currency); },
      onComplete: () => { if (say) say.textContent = `${money(to, total.dataset.currency)}. ${choice}.`; },
    });
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
