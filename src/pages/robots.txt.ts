/** robots.txt: closed to search engines until the real domain is live (INDEXABLE=true at build). */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const open = import.meta.env.INDEXABLE === 'true';
  const body = open
    ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site)}\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
