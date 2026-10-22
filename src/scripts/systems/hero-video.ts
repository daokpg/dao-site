/**
 * The hero film: the adaptive HLS stream, native on Safari, hls.js (its light build) where Media
 * Source Extensions exist (loaded only on the page that needs it), at no more than the player's
 * size in CSS pixels. The page ships the poster and, in data-mp4, a local 720p MP4 that is
 * fetched only if the stream cannot play. With reduced motion the film does not play and the
 * poster stands.
 *
 * It rests while the paper sheet covers the hero and goes on when the hero shows again. Its control
 * ([data-film-toggle], labelled from content in data-pause / data-play) appears once it plays; a
 * film paused there stays paused until played there.
 */
import { gsap, ScrollTrigger } from '../core/gsap';
import { E, reducedMotion } from '../core/env';
import type { System } from '../core/registry';

type Hls = import('hls.js').default;
type State = {
  video: HTMLVideoElement; hls: Hls | null; ac: AbortController; toggle: HTMLButtonElement | null;
  /** under the sheet; paused from the control */
  covered: boolean; held: boolean;
  /** plays or rests the film as the two say */
  sync: () => void;
};
let state: State | null = null;

function destroy() {
  if (!state) return;
  state.ac.abort();
  state.hls?.destroy();
  if (state.toggle) gsap.killTweensOf(state.toggle);
  state = null;
}

async function before(scope: HTMLElement) {
  destroy();
  const video = scope.querySelector<HTMLVideoElement>('[data-hls]');
  if (!video) return;
  const ac = new AbortController();
  const toggle = scope.querySelector<HTMLButtonElement>('[data-film-toggle]');
  const me: State = (state = { video, hls: null, ac, toggle, covered: false, held: false, sync: () => {} });

  // from here the script starts the film (the attribute is for a page without it)
  video.autoplay = false;
  if (reducedMotion) {
    video.pause();
    return;
  }

  const src = video.dataset.hls!;
  const local = video.dataset.mp4;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  const play = () => { if (!me.covered && !me.held) void video.play().catch(() => {}); };
  me.sync = () => (me.covered || me.held ? video.pause() : play());
  if (toggle) {
    video.addEventListener('playing', () => {
      toggle.hidden = false;
      gsap.fromTo(toggle, { opacity: 0 }, { opacity: 1, duration: 1, ease: E });
    }, { once: true, signal: ac.signal });
    toggle.addEventListener('click', () => {
      me.held = !me.held;
      toggle.textContent = (me.held ? toggle.dataset.play : toggle.dataset.pause) ?? '';
      me.sync();
    }, { signal: ac.signal });
  }
  const mp4 = () => {
    if (local && (video.getAttribute('src') !== local || !video.currentSrc)) video.src = local;
    play();
  };
  const native = !!video.canPlayType('application/vnd.apple.mpegurl');

  // Safari with ManagedMediaSource plays HLS natively and better than through MSE.
  if (native && 'ManagedMediaSource' in window) {
    video.src = src;
    video.addEventListener('loadedmetadata', play, { once: true, signal: ac.signal });
    return;
  }

  const { default: HlsCtor } = await import('hls.js/light');
  if (state !== me) return; // the page changed while hls.js loaded
  if (HlsCtor.isSupported()) {
    // never a level larger than the player at 1x (the film sits under a scrim)
    const hls = new HlsCtor({ maxBufferLength: 10, capLevelToPlayerSize: true, maxDevicePixelRatio: 1, startLevel: -1 });
    me.hls = hls;
    hls.on(HlsCtor.Events.MEDIA_ATTACHED, () => hls.loadSource(src));
    hls.on(HlsCtor.Events.MANIFEST_PARSED, play);
    hls.on(HlsCtor.Events.ERROR, (_e, d) => {
      if (!d.fatal) return;
      hls.destroy();
      me.hls = null;
      mp4();
    });
    hls.attachMedia(video);
  } else if (native) {
    video.src = src;
    video.addEventListener('loadedmetadata', play, { once: true, signal: ac.signal });
  } else {
    mp4();
  }
}

/** The sheet that slides over the hero (the hero's data-recede-panel) rests the film while it covers it. */
function after(scope: HTMLElement) {
  const me = state;
  if (!me || reducedMotion) return;
  const hero = me.video.closest<HTMLElement>('[data-recede-panel]');
  const sheet = hero && scope.querySelector(hero.dataset.recedePanel || '');
  if (!sheet) return;
  const st = ScrollTrigger.create({
    trigger: sheet, start: 'top top',
    onToggle: (t) => { me.covered = t.isActive; me.sync(); },
  });
  if (st.isActive !== me.covered) { me.covered = st.isActive; me.sync(); }
}

export const system: System = {
  selector: '[data-hls]',
  before: (scope) => void before(scope),
  after,
  destroy,
};
