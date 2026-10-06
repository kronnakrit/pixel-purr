// Bundled fonts (work offline inside the app): Lilita One for display, Nunito for UI copy.
import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';

export const FONT_DISPLAY = "'Lilita One', 'Arial Rounded MT Bold', system-ui, sans-serif";
export const FONT_BODY = "'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Resolves when both faces are ready (canvas text needs them loaded first). */
export async function fontsReady(): Promise<void> {
  try { await Promise.all([document.fonts.load(`32px 'Lilita One'`), document.fonts.load(`800 16px 'Nunito'`)]); } catch { /* fall back silently */ }
}
