/**
 * The day section's last photograph carried into the evening section's own, as one image.
 *
 * When the last frame's centre reaches the middle of the screen it is lifted off the page: a copy (the "ghost") takes its place, fixed to the screen. From there, with
 * the scroll, the ghost grows in one straight move to exactly where the evening photograph
 * ([data-handoff-target]) will be when its top reaches 14% of the screen, while the page goes on
 * scrolling underneath; the picture inside it goes from the source's crop to the evening one's. At
 * that point the two coincide and the real photograph takes over. Both ends are screen positions,
 * so the move never rises with the page and comes back down. The paper turns to charcoal halfway.
 *
 * The evening photograph's own opening and drift are switched off: it arrives already open.
 */
import { gsap, ScrollTrigger } from '../../core/gsap';
import { setNight } from '../../core/tone';
import type { State } from './shared';

const ease = gsap.parseEase('power2.inOut');
const START_AT = 0.5; // the frame's centre, as a share of the screen height, when it is lifted off
const END_AT = 0.14; // the evening photograph's top, as a share of the screen height, when it takes over

type Options = { onProgress?: (p: number) => void };

/** `source`: the frame to lift off; its first picture is the one carried. */
export function handoff(source: HTMLElement, me: State, scope: HTMLElement, { onProgress }: Options = {}) {
  const target = scope.querySelector<HTMLElement>('[data-handoff-target]');
  const main = scope.closest('main') ?? scope;
  const img = source.querySelector('img');
  if (!target || !img) return;

  // the evening photograph arrives open and still
  const mask = target.querySelector<HTMLElement>('[data-mask]');
  const targetImg = target.querySelector<HTMLImageElement>('img');
  if (mask) {
    ScrollTrigger.getAll().filter((st) => st.trigger === mask).forEach((st) => st.kill());
    gsap.killTweensOf([mask, targetImg]);
    gsap.set(mask, { clipPath: 'none' });
    if (targetImg) gsap.set(targetImg, { scale: 1, yPercent: 0 });
  }

  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText = 'position:fixed;z-index:5;overflow:hidden;pointer-events:none;display:none';
  // the copy keeps the frame's files, chosen for the evening photograph's width (the size it grows to)
  const pic = img.closest('picture')?.cloneNode(true) as HTMLPictureElement | undefined;
  const copy = (pic?.querySelector('img') ?? img.cloneNode()) as HTMLImageElement;
  if (copy.srcset) copy.sizes = '100vw';
  copy.removeAttribute('loading');
  copy.alt = '';
  // the picture's box inside the frame is drawn from the source's at lift-off to the evening
  // photograph's at the end (see paint), so neither end jumps
  copy.style.cssText = 'position:absolute;object-fit:cover;display:block';
  ghost.append(pic ?? copy);
  main.append(ghost);
  target.style.visibility = 'hidden';
  me.cleanups.push(() => {
    ghost.remove();
    target.style.visibility = '';
    source.style.visibility = '';
  });

  /**
   * The picture's box inside its frame, as shares of the frame, and its crop. Its drift is left out:
   * at the two ends it is nothing (the source's centre is at the middle of the screen, the evening
   * photograph's drift is switched off).
   */
  type Inner = { l: number; t: number; w: number; h: number; px: number; py: number };
  const inner = (frame: Element, pic: HTMLImageElement): Inner => {
    const f = frame.getBoundingClientRect(), r = pic.getBoundingClientRect();
    const cs = getComputedStyle(pic);
    const drift = cs.transform === 'none' ? 0 : new DOMMatrixReadOnly(cs.transform).m42;
    const [px = 50, py = 50] = (cs.objectPosition || '50% 50%').split(' ').map((v) => parseFloat(v));
    return { l: (r.left - f.left) / f.width, t: (r.top - drift - f.top) / f.height, w: r.width / f.width, h: r.height / f.height, px, py };
  };
  // where the frame is lifted off, and its picture's box. The height on screen is the trigger's (its
  // centre at START_AT), not wherever the frame is when the first update comes, which after a jump
  // is far past it; sideways it is where the wave has it then.
  let from: { left: number; top: number; width: number; height: number } | null = null;
  let picFrom: Inner | null = null, picTo: Inner | null = null;
  const reset = () => { from = null; picFrom = null; picTo = null; };
  let dark = false;
  const paint = (p: number) => {
    const moving = p > 0 && p < 1;
    if (p <= 0) { reset(); source.style.visibility = ''; }
    else if (!from) {
      const r = source.getBoundingClientRect();
      from = { left: r.left, top: window.innerHeight * START_AT - r.height / 2, width: r.width, height: r.height };
      picFrom = inner(source, img);
      picTo = targetImg ? inner(target, targetImg) : { l: 0, t: 0, w: 1, h: 1, px: 50, py: 50 };
    }
    ghost.style.display = moving ? 'block' : 'none';
    if (p > 0) source.style.visibility = 'hidden';
    target.style.visibility = p >= 1 ? '' : 'hidden';
    if (moving && from) {
      const H = window.innerHeight;
      const b = target.getBoundingClientRect();
      const e = ease(p);
      const mix = (x: number, y: number) => x + (y - x) * e;
      ghost.style.left = `${mix(from.left, b.left).toFixed(1)}px`;
      ghost.style.top = `${mix(from.top, H * END_AT).toFixed(1)}px`;
      ghost.style.width = `${mix(from.width, b.width).toFixed(1)}px`;
      ghost.style.height = `${mix(from.height, b.height).toFixed(1)}px`;
      if (picFrom && picTo) {
        const a = picFrom, z = picTo;
        copy.style.left = `${(mix(a.l, z.l) * 100).toFixed(3)}%`;
        copy.style.top = `${(mix(a.t, z.t) * 100).toFixed(3)}%`;
        copy.style.width = `${(mix(a.w, z.w) * 100).toFixed(3)}%`;
        copy.style.height = `${(mix(a.h, z.h) * 100).toFixed(3)}%`;
        copy.style.objectPosition = `${mix(a.px, z.px).toFixed(2)}% ${mix(a.py, z.py).toFixed(2)}%`;
      }
    }
    const night = p > 0.45;
    if (night !== dark) { dark = night; setNight(scope, night); }
    onProgress?.(p);
  };

  ScrollTrigger.create({
    trigger: source,
    start: `center ${START_AT * 100}%`,
    endTrigger: target,
    end: `top ${END_AT * 100}%`,
    onUpdate: (st) => paint(st.progress),
    onLeave: () => paint(1),
    onLeaveBack: () => paint(0),
    // sizes and places change with the layout: measured again from the new one
    onRefresh: (st) => { reset(); paint(st.progress); },
  });
}
