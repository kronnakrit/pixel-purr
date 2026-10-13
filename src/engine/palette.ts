// 12 candy colours. Index 0 = empty pixel. Each colour is one Purrlet.
export interface Paint { key: PaintKey; name: string; hex: string; light: string; dark: string }

export const PAINT_KEYS = ['cherry', 'tangerine', 'lemon', 'matcha', 'mint', 'soda', 'grape', 'lilac', 'bubblegum', 'cocoa', 'milk', 'licorice'] as const;
export type PaintKey = (typeof PAINT_KEYS)[number];

export const PALETTE: readonly (Paint | null)[] = [null,
  { key: 'cherry', name: 'Cherry', hex: '#FF4D6D', light: '#FF9AAE', dark: '#C21E4A' },
  { key: 'tangerine', name: 'Tangerine', hex: '#FF9838', light: '#FFC680', dark: '#D2611A' },
  { key: 'lemon', name: 'Lemon', hex: '#FFD43B', light: '#FFF08A', dark: '#D79A12' },
  { key: 'matcha', name: 'Matcha', hex: '#5FCB5A', light: '#A5EC8C', dark: '#2E9440' },
  { key: 'mint', name: 'Mint', hex: '#8FF0CF', light: '#D2FFEE', dark: '#3FBF98' },
  { key: 'soda', name: 'Soda', hex: '#3FB8F5', light: '#9BE0FF', dark: '#1A7CC9' },
  { key: 'grape', name: 'Grape', hex: '#8E5BF0', light: '#BFA0FF', dark: '#5B2FC0' },
  { key: 'lilac', name: 'Lilac', hex: '#C9A8FF', light: '#EADCFF', dark: '#9473D9' },
  { key: 'bubblegum', name: 'Bubblegum', hex: '#FF7EC8', light: '#FFC0E4', dark: '#D6449A' },
  { key: 'cocoa', name: 'Cocoa', hex: '#9A5B3A', light: '#C98A62', dark: '#673620' },
  { key: 'milk', name: 'Milk', hex: '#FBF6FF', light: '#FFFFFF', dark: '#CFC3DE' },
  { key: 'licorice', name: 'Licorice', hex: '#3A2F55', light: '#6A5C8E', dark: '#1E1733' },
];

/** Colour index by key, e.g. C.cherry === 1. */
export const C = Object.fromEntries(PAINT_KEYS.map((k, i) => [k, i + 1])) as Record<PaintKey, number>;
export const COLOR_COUNT = PAINT_KEYS.length;

export function paint(c: number): Paint {
  const p = PALETTE[c];
  if (!p) throw new Error(`no paint colour ${c}`);
  return p;
}
