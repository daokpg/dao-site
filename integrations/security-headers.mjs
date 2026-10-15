/**
 * Writes the Content-Security-Policy into dist/_headers after every build, so it always matches
 * what was built:
 *   - script-src allows our own files plus the exact inline scripts the pages carry (their
 *     sha256 hashes, read from the built HTML), and nothing else;
 *   - connect-src allows the booking backend's origin (PUBLIC_BOOKING_API) when one is set.
 * public/_headers holds the rest of the headers and the policy with two placeholders:
 * {{INLINE_SCRIPT_HASHES}} and {{BOOKING_API_ORIGINS}}.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g;

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

export default function securityHeaders() {
  return {
    name: 'dao-security-headers',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const hashes = new Set();
        for (const file of await htmlFiles(root)) {
          for (const [, body] of (await readFile(file, 'utf8')).matchAll(INLINE_SCRIPT)) {
            hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
          }
        }
        // the Apps Script web app answers from script.google.com, then redirects to googleusercontent
        const api = process.env.PUBLIC_BOOKING_API;
        const origins = new Set();
        if (api) {
          origins.add(new URL(api).origin);
          if (new URL(api).hostname === 'script.google.com') origins.add('https://script.googleusercontent.com');
        }
        const file = join(root, '_headers');
        const text = await readFile(file, 'utf8');
        await writeFile(file, text
          .replace('{{INLINE_SCRIPT_HASHES}}', [...hashes].join(' '))
          .replace('{{BOOKING_API_ORIGINS}}', [...origins].join(' ')));
        logger.info(`Content-Security-Policy: ${hashes.size} inline script(s) allowed by hash${origins.size ? `, booking API ${[...origins].join(', ')}` : ''}`);
      },
    },
  };
}
