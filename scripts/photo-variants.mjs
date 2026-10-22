/**
 * WebP copies of the photography, for srcset: `name-800.webp` and `name-1600.webp` next to each
 * `name.jpg` in public/assets/photos (and its folders), and the list of them in
 * src/lib/photo-variants.json, which ui/Picture.astro reads. Never upscaled: a photograph narrower
 * than 1600px gets its large copy at its own width (`name-1069.webp`), and one within 10% of 800px
 * gets only that, so the width in a file's name is always its real one. The originals are left as
 * they are and stay the fallback. Run it after adding or replacing a photograph, and commit both.
 *
 *   npm run photos            writes what is missing or older than its original
 *   npm run photos -- --force rewrites every copy
 */
import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC = 'public';
const ROOT = 'public/assets/photos';
const MANIFEST = 'src/lib/photo-variants.json';
const WIDTHS = [800, 1600];
const QUALITY = 75;
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
  for (const w of widths) {
    const out = `${base}-${w}.webp`;
    if (!force && (await mtime(out)) >= original) continue;
    await sharp(file).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(out);
    written++;
    console.log(`${out}  ${Math.round((await stat(out)).size / 1024)} KB`);
  }
  manifest[`/${path.relative(PUBLIC, file).split(path.sep).join('/')}`] = widths;
}
const lines = Object.entries(manifest).map(([src, widths]) => `  ${JSON.stringify(src)}: ${JSON.stringify(widths)}`);
await writeFile(MANIFEST, `{\n${lines.join(',\n')}\n}\n`);
console.log(`${written ? `${written} file(s) written` : 'all photo copies are up to date'}; ${MANIFEST} lists ${Object.keys(manifest).length} photographs`);
