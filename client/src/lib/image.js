// Client-side photo prep: shrink before upload and detect the garment's main color.
import { rgbToHex } from '@outfitiq/shared/colors.js';

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Fallback for browsers/formats createImageBitmap can't handle.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Resize to fit `maxSize`, re-encode as JPEG and detect the dominant color. */
export async function prepareImage(file, maxSize = 1000) {
  const img = await decode(file);
  const w = img.width, h = img.height;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // flatten transparent PNGs onto white
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  return { blob, color: dominantColor(canvas), previewUrl: URL.createObjectURL(blob) };
}

// Estimate the background from the border, then take the most common non-background
// color bucket in the centre of the photo.
export function dominantColor(source) {
  const N = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, N, N);
  const data = ctx.getImageData(0, 0, N, N).data;
  const px = (x, y) => { const i = (y * N + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };

  let bg = [0, 0, 0], count = 0;
  for (let i = 0; i < N; i++) {
    for (const [x, y] of [[i, 0], [i, N - 1], [0, i], [N - 1, i]]) {
      const p = px(x, y);
      bg[0] += p[0]; bg[1] += p[1]; bg[2] += p[2]; count++;
    }
  }
  bg = bg.map(v => v / count);

  const buckets = new Map();
  const lo = Math.floor(N * 0.18), hi = Math.ceil(N * 0.82);
  const avg = [0, 0, 0, 0];
  for (let y = lo; y < hi; y++) {
    for (let x = lo; x < hi; x++) {
      const [r, g, b] = px(x, y);
      avg[0] += r; avg[1] += g; avg[2] += b; avg[3]++;
      if (Math.hypot(r - bg[0], g - bg[1], b - bg[2]) < 42) continue;
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      const bucket = buckets.get(key) || [0, 0, 0, 0];
      bucket[0] += r; bucket[1] += g; bucket[2] += b; bucket[3]++;
      buckets.set(key, bucket);
    }
  }
  let best = null;
  for (const b of buckets.values()) if (!best || b[3] > best[3]) best = b;
  // Garment same color as the background (white shirt on white sheet): use the centre average.
  if (!best || best[3] < (hi - lo) ** 2 * 0.06) best = avg;
  return rgbToHex(best[0] / best[3], best[1] / best[3], best[2] / best[3]);
}
