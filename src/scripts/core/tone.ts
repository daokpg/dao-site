/**
 * Nav tone. The nav reads cream whenever any reason holds (over a photograph, on dark ground,
 * dusk has fallen, the menu is open) and ink otherwise. One attribute on <html> carries it; the
 * colours live in styles/chrome.css.
 */
export type ToneReason = 'page' | 'dark' | 'dusk' | 'menu';

const reasons = new Set<ToneReason>();

function apply() {
  document.documentElement.dataset.navTone = reasons.size ? 'cream' : 'ink';
}

export function setTone(reason: ToneReason, cream: boolean) {
  if (cream) reasons.add(reason);
  else reasons.delete(reason);
  apply();
}

/** On page entry: drop everything the last page set, keep the menu, take the new page's base tone. */
export function resetTone(pageCream: boolean) {
  for (const r of [...reasons]) if (r !== 'menu') reasons.delete(r);
  if (pageCream) reasons.add('page');
  apply();
}

/** Night on the home page: the paper sheet ([data-sheet]) runs to charcoal and the nav follows. */
export function setNight(scope: HTMLElement, dark: boolean) {
  const sheet = scope.querySelector<HTMLElement>('[data-sheet]');
  if (sheet) sheet.dataset.theme = dark ? 'dark' : 'light';
  setTone('dark', dark);
}
