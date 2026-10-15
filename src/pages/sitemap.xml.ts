/** sitemap.xml: every page, from the one list of pages (site.pages and site.unlisted). */
import type { APIRoute } from 'astro';
import { getSite } from '../lib/content';

export const GET: APIRoute = async ({ site }) => {
  const { pages, unlisted } = await getSite();
  const urls = [...pages, ...unlisted].map((p) => `  <url><loc>${new URL(p.href, site)}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
