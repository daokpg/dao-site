/**
 * Text splitting for reveals. Lines are measured from the laid-out text, so a split is
 * only right for the width and font it was taken at: re-split after fonts load and on
 * resize (systems/reveal.ts does both).
 */

/** Group words into the lines they currently wrap onto. */
function measureLines(el: HTMLElement, words: string[]) {
  el.textContent = '';
  const spans = words.map((w) => {
    const s = document.createElement('span');
    s.textContent = w;
    s.style.display = 'inline-block';
    el.appendChild(s);
    el.appendChild(document.createTextNode(' '));
    return s;
  });
  const lines: string[][] = [];
  let top: number | null = null;
  for (const s of spans) {
    if (s.offsetTop !== top) {
      top = s.offsetTop;
      lines.push([]);
    }
    lines[lines.length - 1].push(s.textContent ?? '');
  }
  el.textContent = '';
  return lines;
}

/**
 * Soft lines: each line its own block, rising and sharpening in place, no mask.
 * The source text is kept on the element so it can be re-split; a paragraph already
 * revealed stays revealed.
 */
export function splitSoftLines(el: HTMLElement) {
  if (!el.dataset.text) el.dataset.text = (el.textContent ?? '').trim();
  const shown = el.dataset.revealed === '1';
  const lines = measureLines(el, el.dataset.text.split(/\s+/));
  for (const ws of lines) {
    const l = document.createElement('span');
    l.setAttribute('data-line-soft', '');
    l.textContent = ws.join(' ');
    if (shown) l.style.cssText = 'opacity:1;transform:none;filter:none';
    el.appendChild(l);
  }
  // a single word wider than the box would overflow on one nowrap line; let it wrap
  const box = el.clientWidth + 1;
  el.querySelectorAll<HTMLElement>('[data-line-soft]').forEach((l) => {
    if (l.scrollWidth > box) l.style.whiteSpace = 'normal';
  });
  el.setAttribute('data-split-ready', '');
}

/** Masked lines: each line slides up out of its own clipped row (captions). */
export function splitLines(el: HTMLElement) {
  if (!el.dataset.text) el.dataset.text = (el.textContent ?? '').trim();
  const lines = measureLines(el, el.dataset.text.split(/\s+/));
  for (const ws of lines) {
    const outer = document.createElement('span');
    outer.setAttribute('data-line', '');
    const inner = document.createElement('span');
    inner.setAttribute('data-line-inner', '');
    inner.textContent = ws.join(' ');
    outer.appendChild(inner);
    el.appendChild(outer);
  }
  el.setAttribute('data-split-ready', '');
  return el.querySelectorAll<HTMLElement>('[data-line-inner]');
}

/**
 * Display lines marked data-fit take the width of their cell:
 * font-size = cell width / text width at 100px.
 */
export function fitLines(scope: ParentNode) {
  scope.querySelectorAll<HTMLElement>('[data-fit]').forEach((el) => {
    const probe = document.createElement('span');
    probe.textContent = el.dataset.text || el.textContent;
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:300 100px/1 var(--font-display);letter-spacing:-.04em';
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    if (w > 0) el.style.fontSize = `${Math.floor((el.clientWidth / w) * 100 * 0.995)}px`;
  });
}
