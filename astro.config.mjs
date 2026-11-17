import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import securityHeaders from './integrations/security-headers.mjs';

// Build variables come from the environment or from .env (Astro sets NODE_ENV to the build's mode).
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

// The site's address, for canonical links, share previews and the sitemap. Set SITE_URL to the real
// domain when it is attached (and INDEXABLE=true to let search engines in); until then it is staging.
const site = env.SITE_URL || 'https://dao-design.daokpg.workers.dev';

// A public build (INDEXABLE=true) must name its own address and a real booking backend: without the
// backend, "Request the seats" only shows the confirmation, which no guest should ever see.
const launchGuards = {
  name: 'dao-launch-guards',
  hooks: {
    'astro:config:setup': ({ command }) => {
      if (command !== 'build' || env.INDEXABLE !== 'true') return;
      const missing = ['SITE_URL', 'PUBLIC_BOOKING_API'].filter((key) => !env[key]);
      if (missing.length) {
        throw new Error(`INDEXABLE=true builds the public site, but ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set. Set ${missing.length > 1 ? 'them' : 'it'} in Cloudflare's build variables (or .env), or build without INDEXABLE for staging.`);
      }
    },
  },
};

export default defineConfig({
  site,
  // Pages build to /story.html etc. so the live URLs stay /story, /evening, /reserve.
  build: {
    format: 'file',
    // Every page ships the same stylesheet bundle, so a Barba swap never needs CSS it does not have.
    inlineStylesheets: 'never',
  },
  trailingSlash: 'never',
  // Writes the Content-Security-Policy into dist/_headers from what was built (see the file).
  integrations: [launchGuards, securityHeaders()],
  devToolbar: { enabled: false },
  vite: {
    // Pre-bundle the motion stack so a mid-session re-optimise cannot strand an open tab (boilerplate trap 11).
    optimizeDeps: {
      include: ['gsap', 'gsap/ScrollTrigger', 'lenis', '@barba/core', 'hls.js'],
    },
  },
});
