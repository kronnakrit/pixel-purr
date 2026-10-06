// STUB — replaced by the content module. Keep the exported names and types.
import type { ContentApi } from '../app/contracts';
import { level, paramsFor, PICTURES, raster } from '../engine';

export const content: ContentApi = {
  shipped: 20,
  getLevel: n => level(n),
  levelMeta: n => ({ n, name: PICTURES[(n - 1) % PICTURES.length]!.name, spicy: n % 5 === 0, intro: null, unlocks: null }),
  levelPicture: n => raster(PICTURES[(n - 1) % PICTURES.length]!, paramsFor(n).size),
  introCard: k => ({ title: k, body: '' }),
};
