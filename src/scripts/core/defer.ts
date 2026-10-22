/**
 * Pictures rendered without their files (ui/Picture.astro with `defer`): fetch the ones inside
 * `root` now. The srcset goes on before the src, so the browser chooses once.
 */
export function loadDeferred(root: ParentNode) {
  root.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => {
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    img.removeAttribute('data-srcset');
    img.src = img.dataset.src!;
    img.removeAttribute('data-src');
  });
}
