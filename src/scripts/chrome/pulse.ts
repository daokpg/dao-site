/** Pressing any .lt-host control plays a short pulse through its letters (styles in global.css). */
export function initPressPulse() {
  document.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement & { _pulseT?: number }>('.lt-host');
    if (!el) return;
    el.classList.remove('is-pressed');
    void el.offsetWidth;
    el.classList.add('is-pressed');
    clearTimeout(el._pulseT);
    el._pulseT = window.setTimeout(() => el.classList.remove('is-pressed'), 800);
  }, true);
}
