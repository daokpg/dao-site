/**
 * Makes the icons and the share image in public/ from the mark and a photograph. Run it again
 * when either changes (the output is committed): node tools/share-images.mjs
 *   - favicon-32.png, apple-touch-icon.png (180), icon-512.png: the mark in cream on the night
 *     ground (--cream and --night in src/styles/tokens/colors.css);
 *   - og.jpg: 1200x630, cropped from the home page's table photograph for link previews.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pub = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const colors = await readFile(new URL('../src/styles/tokens/colors.css', import.meta.url), 'utf8');
const token = (name) => colors.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))[1];
const night = token('night');
const cream = token('cream');

// the mark (126x60), drawn in cream, without its metadata
const mark = (await readFile(pub('assets/dao-mark.svg'), 'utf8'))
  .replace(/<metadata>[\s\S]*?<\/metadata>/, '')
  .replaceAll('fill="#000"', `fill="${cream}"`);

// the mark across 80% of a square night tile
async function icon(size, name) {
  const width = Math.round(size * 0.8);
  const drawn = await sharp(Buffer.from(mark), { density: Math.ceil((72 * width * 2) / 126) })
    .resize({ width })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: night } })
    .composite([{ input: drawn, gravity: 'center' }])
    .png()
    .toFile(pub(name));
}
await icon(32, 'favicon-32.png');
await icon(180, 'apple-touch-icon.png');
await icon(512, 'icon-512.png');

// 1400x935 scaled to 1200 wide (1200x801), then 630 tall kept from 60% down: less ceiling, more table
const scaled = await sharp(pub('assets/photos/table-guests.jpg')).resize({ width: 1200 }).toBuffer({ resolveWithObject: true });
await sharp(scaled.data)
  .extract({ left: 0, top: Math.round((scaled.info.height - 630) * 0.6), width: 1200, height: 630 })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(pub('og.jpg'));
console.log('public/: favicon-32.png, apple-touch-icon.png, icon-512.png, og.jpg');
