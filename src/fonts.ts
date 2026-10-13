// Bundled fonts (work offline inside the app): Lilita One for display, Nunito for UI copy. Only the Latin woff2 files
// ship: every copy line is Latin, and every WebView the app runs in reads woff2.
import lilita400 from '@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2?url';
import nunito700 from '@fontsource/nunito/files/nunito-latin-700-normal.woff2?url';
import nunito800 from '@fontsource/nunito/files/nunito-latin-800-normal.woff2?url';
import nunito900 from '@fontsource/nunito/files/nunito-latin-900-normal.woff2?url';

export const FONT_DISPLAY = "'Lilita One', 'Arial Rounded MT Bold', system-ui, sans-serif";
export const FONT_BODY = "'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const FACES: [family: string, weight: number, url: string][] = [
  ['Lilita One', 400, lilita400], ['Nunito', 700, nunito700], ['Nunito', 800, nunito800], ['Nunito', 900, nunito900],
];
if (typeof document !== 'undefined' && !document.getElementById('pp-fonts')) {
  const style = document.createElement('style');
  style.id = 'pp-fonts';
  style.textContent = FACES.map(([f, w, u]) => `@font-face{font-family:'${f}';font-style:normal;font-weight:${w};font-display:swap;src:url("${u}") format('woff2')}`).join('\n');
  document.head.append(style);
}

/** Resolves when both faces are ready (canvas text needs them loaded first). */
export async function fontsReady(): Promise<void> {
  try { await Promise.all([document.fonts.load(`32px 'Lilita One'`), document.fonts.load(`800 16px 'Nunito'`)]); } catch { /* fall back silently */ }
}
