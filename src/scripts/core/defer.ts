/**
 * Pictures rendered without their files (ui/Picture.astro with `defer`): fetch the ones inside
 * `root` now. The WebP source gets its srcset before the <img> its src, so the browser chooses once.
 */
export function loadDeferred(root: ParentNode) {
  root.querySelectorAll<HTMLSourceElement>('source[data-srcset]').forEach((s) => {
    s.srcset = s.dataset.srcset!;
    s.removeAttribute('data-srcset');
  });
  root.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => {
    img.src = img.dataset.src!;
    img.removeAttribute('data-src');
  });
}
