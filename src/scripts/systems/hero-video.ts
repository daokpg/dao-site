/**
 * The hero film. The page ships a local 720p MP4 and a poster, so something always plays;
 * this upgrades it to the adaptive HLS stream: native HLS on Safari, hls.js where Media
 * Source Extensions exist (loaded only on the page that needs it), and back to the MP4 if
 * the stream fails. With reduced motion the film does not play and the poster stands.
 */
import { reducedMotion } from '../core/env';
import type { System } from '../core/registry';

type Hls = import('hls.js').default;
type State = { video: HTMLVideoElement; hls: Hls | null; ac: AbortController };
let state: State | null = null;

function destroy() {
  if (!state) return;
  state.ac.abort();
  state.hls?.destroy();
  state = null;
}

async function before(scope: HTMLElement) {
  destroy();
  const video = scope.querySelector<HTMLVideoElement>('[data-hls]');
  if (!video) return;
  const ac = new AbortController();
  const me: State = (state = { video, hls: null, ac });

  if (reducedMotion) {
    video.autoplay = false;
    video.pause();
    return;
  }

  const src = video.dataset.hls!;
  const local = video.getAttribute('src');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  const play = () => void video.play().catch(() => {});
  video.addEventListener('ended', () => { video.currentTime = 0; play(); }, { signal: ac.signal });
  const mp4 = () => {
    if (local && (video.getAttribute('src') !== local || !video.currentSrc)) video.src = local;
    play();
  };
  const native = !!video.canPlayType('application/vnd.apple.mpegurl');
  play();

  // Safari with ManagedMediaSource plays HLS natively and better than through MSE.
  if (native && 'ManagedMediaSource' in window) {
    video.src = src;
    video.addEventListener('loadedmetadata', play, { once: true, signal: ac.signal });
    return;
  }

  const { default: HlsCtor } = await import('hls.js');
  if (state !== me) return; // the page changed while hls.js loaded
  if (HlsCtor.isSupported()) {
    const hls = new HlsCtor({ maxBufferLength: 10, capLevelToPlayerSize: true, startLevel: -1 });
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

export const system: System = {
  selector: '[data-hls]',
  before: (scope) => void before(scope),
  destroy,
};
