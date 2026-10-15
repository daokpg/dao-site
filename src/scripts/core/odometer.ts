/**
 * Numbers that change by rolling, like a mechanical counter (after Osmo's Number Odometer).
 *
 *   const odo = odometer(el);   // el holds the starting text, e.g. "07:00"
 *   odo.set('09:00');           // digits roll forward to the new value
 *   odo.set('07:00', -1);       // ...or back, when the change goes the other way
 *
 * Every digit becomes a masked strip of 0–9 three times over, resting on the middle run, so it can
 * roll forward or back without running out. Other characters (":", "/", letters) stay put. Only the
 * digits that change move, right to left with a small stagger. A change arriving mid-roll carries on
 * from wherever the strips are. The strips stay in place between changes (the value changes often);
 * the element's aria-label always holds the plain value. Reduced motion sets the value directly.
 *
 * Each digit sits in a window at least 1.2em tall (taller than the glyphs, so its neighbours on the
 * strip never show), pulled back to the element's own line height with negative margins so the
 * layout does not move. Styles for the parts are in global.css.
 */
import { gsap } from './gsap';
import { reducedMotion } from './env';

const DURATION = 1;
const EASE = 'power3.out';
const STAGGER = 0.04;

/** A digit's strip; `pos` is the cell showing in the window (fractional mid-roll). */
type Column = { strip: HTMLElement; digit: number; pos: number };

const place = (c: Column, step: number) => { c.strip.style.transform = `translate3d(0,${(-c.pos * step).toFixed(4)}em,0)`; };

export function odometer(el: HTMLElement) {
  const line = (() => {
    const cs = getComputedStyle(el);
    return cs.lineHeight === 'normal' ? 1.2 : parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
  })();
  const step = Math.max(line, 1.2);
  const cell = (s: HTMLElement) => {
    s.style.height = `${step}em`;
    s.style.lineHeight = String(step);
    s.style.marginBlock = `${((line - step) / 2).toFixed(3)}em`;
  };
  let text = el.textContent?.trim() ?? '';
  let columns: (Column | null)[] = [];

  /** One masked strip per digit, a plain span for everything else. */
  const build = (value: string) => {
    el.textContent = '';
    el.setAttribute('aria-label', value);
    columns = [...value].map((ch) => {
      if (!/\d/.test(ch)) {
        const s = document.createElement('span');
        s.dataset.odometerPart = 'static';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = ch;
        cell(s);
        el.append(s);
        return null;
      }
      const mask = document.createElement('span');
      mask.dataset.odometerPart = 'mask';
      mask.setAttribute('aria-hidden', 'true');
      cell(mask);
      const strip = document.createElement('span');
      strip.dataset.odometerPart = 'strip';
      strip.style.lineHeight = String(step);
      strip.textContent = Array.from({ length: 30 }, (_, i) => i % 10).join('\n');
      mask.append(strip);
      el.append(mask);
      const digit = Number(ch);
      const c = { strip, digit, pos: 10 + digit };
      place(c, step);
      return c;
    });
  };

  build(text);

  /** Same characters in the same places apart from the digits: the strips can roll. */
  const sameShape = (a: string, b: string) => a.length === b.length && [...a].every((c, i) => /\d/.test(c) ? /\d/.test(b[i]) : c === b[i]);

  return {
    set(value: string, dir: 1 | -1 = 1) {
      if (value === text) return;
      if (!sameShape(text, value) || reducedMotion) {
        gsap.killTweensOf(columns.filter(Boolean));
        text = value;
        build(value);
        return;
      }
      text = value;
      el.setAttribute('aria-label', value);
      const digits = [...value];
      const moving = columns.map((c, i) => (c && Number(digits[i]) !== c.digit ? i : -1)).filter((i) => i >= 0);
      moving.forEach((i, order) => {
        const c = columns[i]!;
        const next = Number(digits[i]);
        // from wherever the strip is now (mid-roll or at rest), the nearest cell showing the new digit
        // in the direction of travel; strips rest on the middle run, so there is always one
        let target = 10 + next;
        for (let k = 0; k < 30; k++) {
          const at = dir > 0 ? Math.ceil(c.pos + 0.001) + k : Math.floor(c.pos - 0.001) - k;
          if (at < 0 || at > 29) break;
          if (at % 10 === next) { target = at; break; }
        }
        c.digit = next;
        gsap.killTweensOf(c);
        gsap.to(c, {
          pos: target,
          duration: DURATION,
          ease: EASE,
          delay: (moving.length - 1 - order) * STAGGER,
          onUpdate: () => place(c, step),
          // back to the middle run, the same picture, ready for the next roll either way
          onComplete: () => { c.pos = 10 + next; place(c, step); },
        });
      });
    },
    get value() {
      return text;
    },
    /** Stop any roll where it is (on leaving the page). */
    stop() {
      gsap.killTweensOf(columns.filter(Boolean));
    },
  };
}
