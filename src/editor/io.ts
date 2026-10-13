// Editor I/O: LevelFileV1 export (clipboard + download) and import, PNG import via a canvas downscale.
import { fromFile, fromRGBA, toFile, type Level, type LevelFileV1, type Picture } from '../engine';

export function levelJson(n: number, L: Level): string {
  return JSON.stringify(toFile(n, L));
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function download(name: string, text: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Parse one LevelFileV1 (or pick from an array, e.g. levels-61-100.json, by level number). Throws on bad files. */
export function parseLevel(text: string, preferN?: number): { n: number; level: Level } {
  const data = JSON.parse(text) as LevelFileV1 | LevelFileV1[];
  const files = Array.isArray(data) ? data : [data];
  const f = files.find(x => x.n === preferN) ?? files[0];
  if (!f) throw new Error('no level in that file');
  return { n: f.n, level: fromFile(f) };
}

export function readFile(file: File): Promise<string> { return file.text(); }

/** Load an image file, fit it into an N×N square (keeping its aspect) and snap it to at most K palette colours. */
export async function pictureFromImage(file: File, N: number, K: number): Promise<Picture> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const k = Math.min(N / img.naturalWidth, N / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
    g.drawImage(img, (N - w) / 2, (N - h) / 2, w, h);
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return fromRGBA(g.getImageData(0, 0, N, N).data, N, K, name || 'Your picture');
  } finally {
    URL.revokeObjectURL(url);
  }
}
