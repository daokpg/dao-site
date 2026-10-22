/**
 * The day section's last photograph carried into the evening section's own, as one image.
 *
 * When the last frame's centre reaches the middle of the screen (or wherever `start` says) it is
 * lifted off the page: a copy (the "ghost") takes its place, fixed to the screen. From there, with
 * the scroll, the ghost grows in one straight move to exactly where the evening photograph
 * ([data-trail-handoff]) will be when its top reaches 14% of the screen, while the page goes on
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
const END_AT = 0.14; // the evening photograph's top, as a share of the screen height, when it takes over

/**
 * `pickSource`: the frame to lift off, or a function choosing it at the moment of lift-off.
 * The frame's first picture is the one carried.
 */
type Options = { trigger?: Element; start?: string; onProgress?: (p: number) => void };

export function handoff(pickSource: HTMLElement | (() => HTMLElement), me: State, scope: HTMLElement, { trigger, start = 'center 50%', onProgress }: Options = {}) {
  const choose = typeof pickSource === 'function' ? pickSource : () => pickSource;
  let source = choose();
  const target = scope.querySelector<HTMLElement>('[data-trail-handoff]');
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
  // a <picture> goes with its WebP source, drawn at the evening photograph's width (the size it grows to)
  const pic = img.closest('picture')?.cloneNode(true) as HTMLPictureElement | undefined;
  pic?.querySelector('source')?.setAttribute('sizes', '100vw');
  const copy = (pic?.querySelector('img') ?? img.cloneNode()) as HTMLImageElement;
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

  /** The picture's box inside its frame, as shares of the frame, and its crop. */
  type Inner = { l: number; t: number; w: number; h: number; px: number; py: number };
  const inner = (frame: Element, pic: HTMLImageElement): Inner => {
    const f = frame.getBoundingClientRect(), r = pic.getBoundingClientRect();
    const [px = 50, py = 50] = (getComputedStyle(pic).objectPosition || '50% 50%').split(' ').map((v) => parseFloat(v));
    return { l: (r.left - f.left) / f.width, t: (r.top - f.top) / f.height, w: r.width / f.width, h: r.height / f.height, px, py };
  };
  // where the frame was lifted off: its place and size on screen at that moment, and its picture's box
  let from: { left: number; top: number; width: number; height: number } | null = null;
  let picFrom: Inner | null = null, picTo: Inner | null = null;
  let dark = false;
  const paint = (p: number) => {
    const moving = p > 0 && p < 1;
    if (p <= 0) { from = null; source.style.visibility = ''; }
    else if (!from) {
      source = choose();
      const r = source.getBoundingClientRect();
      from = { left: r.left, top: r.top, width: r.width, height: r.height };
      picFrom = inner(source, source.querySelector('img') ?? img);
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
    trigger: trigger ?? source,
    start,
    endTrigger: target,
    end: `top ${END_AT * 100}%`,
    onUpdate: (st) => paint(st.progress),
    onLeave: () => paint(1),
    onLeaveBack: () => paint(0),
    onRefresh: (st) => paint(st.progress),
  });
}
