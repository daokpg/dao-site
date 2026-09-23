import { defineConfig } from 'astro/config';

export default defineConfig({
  // Pages build to /story.html etc. so the live URLs stay /story, /evening, /reserve.
  build: {
    format: 'file',
    // Every page ships the same stylesheet bundle, so a Barba swap never needs CSS it does not have.
    inlineStylesheets: 'never',
  },
  trailingSlash: 'never',
  devToolbar: { enabled: false },
  vite: {
    // Pre-bundle the motion stack so a mid-session re-optimise cannot strand an open tab (boilerplate trap 11).
    optimizeDeps: {
      include: ['gsap', 'gsap/ScrollTrigger', 'lenis', '@barba/core', 'hls.js'],
    },
  },
});
