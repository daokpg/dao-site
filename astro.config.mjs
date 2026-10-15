import { defineConfig } from 'astro/config';
import securityHeaders from './integrations/security-headers.mjs';

// The site's address, for canonical links, share previews and the sitemap. Set SITE_URL to the real
// domain when it is attached (and INDEXABLE=true to let search engines in); until then it is staging.
const site = process.env.SITE_URL ?? 'https://dao-design.dry-forest-5ebe.workers.dev';

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
  integrations: [securityHeaders()],
  devToolbar: { enabled: false },
  vite: {
    // Pre-bundle the motion stack so a mid-session re-optimise cannot strand an open tab (boilerplate trap 11).
    optimizeDeps: {
      include: ['gsap', 'gsap/ScrollTrigger', 'lenis', '@barba/core', 'hls.js'],
    },
  },
});
