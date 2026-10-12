/** Image helpers: loading, downscaling, data URLs. Never mutates the caller's image. */

export const MAX_LONG_EDGE = 1920;

export function loadImageBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

/**
 * Downscale so the long edge is at most `maxEdge` (default 1920), preserving
 * aspect ratio. Only ever downscales — small images are returned as-is.
 */
export async function fitToMaxEdge(
  bitmap: ImageBitmap,
  maxEdge: number = MAX_LONG_EDGE,
): Promise<ImageBitmap> {
  const w = bitmap.width;
  const h = bitmap.height;
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge) return bitmap;
  const scale = maxEdge / longEdge;
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();
  return createImageBitmap(canvas);
}

export function bitmapToBlob(bitmap: ImageBitmap, type: 'image/png' | 'image/jpeg' = 'image/jpeg', quality = 0.92): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality);
  });
}

export async function makeThumbnail(bitmap: ImageBitmap, maxEdge = 320): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.8),
  );
  if (!blob) throw new Error('thumbnail toBlob failed');
  return blob;
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
