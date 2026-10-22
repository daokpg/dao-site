/**
 * WebP copies of the photography, for srcset: `name-800.webp` and `name-1600.webp` next to each
 * `name.jpg` in public/assets/photos (and its folders), and the list of them in
 * src/lib/photo-variants.json (each photograph's own width and its copies), which ui/Picture.astro
 * reads. Never upscaled: a photograph narrower than 1600px gets its large copy at its own width
 * (`name-1069.webp`), and one within 10% of 800px gets only that, so the width in a file's name is
 * always its real one. A copy at the photograph's own width is kept only if it is clearly lighter
 * than the original; otherwise the original JPEG serves that width, untouched. The originals are
 * left as they are. Run it after adding or replacing a photograph, and commit both.
 *
 *   npm run photos            writes what is missing or older than its original
 *   npm run photos -- --force rewrites every copy
 */
import { readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC = 'public';
const ROOT = 'public/assets/photos';
const MANIFEST = 'src/lib/photo-variants.json';
const WIDTHS = [800, 1600];
const QUALITY = 85;
const KEEP_FULL = 0.85; // a copy at the original's width must weigh under 85% of it // 75 visibly softened the grain of some photographs (prep-trays, the cities) for little saving
const force = process.argv.includes('--force');

async function* photos(dir) {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* photos(file);
    else if (/\.jpe?g$/i.test(entry.name)) yield file;
  }
}

const mtime = (file) => stat(file).then((s) => s.mtimeMs, () => 0);

const manifest = {};
let written = 0;
for await (const file of photos(ROOT)) {
  const { width, height, orientation = 1 } = await sharp(file).metadata();
  // the displayed width: EXIF orientations 5 to 8 turn the picture a quarter
  const shown = orientation >= 5 ? height : width;
  // a copy within 10% of a larger one is not worth a file (an 802px original gets no 800)
  const widths = [...new Set(WIDTHS.map((w) => Math.min(w, shown)))].filter((w, _, all) => !all.some((o) => o > w && o <= w * 1.1));
  const base = file.replace(/\.jpe?g$/i, '');
  const original = await mtime(file);
  const kept = [];
  for (const w of widths) {
    const out = `${base}-${w}.webp`;
    if (force || (await mtime(out)) < original) {
      await sharp(file).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY, smartSubsample: true }).toFile(out);
      written++;
    }
    if (w === shown && (await stat(out)).size > (await stat(file)).size * KEEP_FULL) {
      await rm(out);
      console.log(`${out}  dropped: the original is as light`);
      continue;
    }
    kept.push(w);
  }
  manifest[`/${path.relative(PUBLIC, file).split(path.sep).join('/')}`] = { width: shown, webp: kept };
}
const lines = Object.entries(manifest).map(([src, v]) => `  ${JSON.stringify(src)}: ${JSON.stringify(v)}`);
await writeFile(MANIFEST, `{\n${lines.join(',\n')}\n}\n`);
console.log(`${written ? `${written} file(s) written` : 'all photo copies are up to date'}; ${MANIFEST} lists ${Object.keys(manifest).length} photographs`);
