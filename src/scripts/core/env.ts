/** House constants and live media state, read by every system. */

/** The house curve for anything arriving. */
export const E = 'expo.out';
/** The curve for sheets: gentle release, fast middle, long soft landing. */
export const SHEET = 'expo.inOut';

/** A mask shut to a point at its bottom centre, and fully open. Images open from one to the other. */
export const CLOSED = 'polygon(50% 100%,50% 100%,50% 100%,50% 100%)';
export const OPEN = 'polygon(0% 0%,100% 0%,100% 100%,0% 100%)';

/** The one layout breakpoint. Crossing it reloads the page (see app.ts). */
export const MOBILE_QUERY = '(max-width: 820px)';
export const isMobile = () => matchMedia(MOBILE_QUERY).matches;

export const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const rmQuery = matchMedia(MOTION_QUERY);
/** Reduced motion means the finished state, not faster motion. Read it at the top of every init that animates. */
export let reducedMotion = rmQuery.matches;
rmQuery.addEventListener?.('change', (e) => {
  reducedMotion = e.matches;
});

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
