// Tiny DOM helpers for the editor (no framework, like the app).
type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

/** h('button.go', { onclick }, 'Play') — tag with optional .classes, attributes / on* listeners, children. */
export function h<K extends keyof HTMLElementTagNameMap>(sel: K | `${K}.${string}`, attrs: Attrs = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const [tag, ...cls] = sel.split('.') as [K, ...string[]];
  const el = document.createElement(tag);
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c) el.append(c);
  return el;
}

/** Labelled number input. */
export function numField(label: string, value: number, opt: { min?: number; max?: number; step?: number; title?: string } = {}): { el: HTMLLabelElement; input: HTMLInputElement; get(): number; set(v: number): void } {
  const input = h('input', { type: 'number', value, min: opt.min, max: opt.max, step: opt.step ?? 1 });
  const el = h('label.field', { title: opt.title }, h('span', { text: label }), input);
  return { el, input, get: () => Number(input.value), set: v => { input.value = String(v); } };
}

export function button(label: string, onclick: () => void, cls = '', title?: string): HTMLButtonElement {
  return h(`button${cls ? '.' + cls.split(' ').join('.') : ''}` as 'button', { type: 'button', onclick: () => onclick(), title }, label);
}

export function section(title: string, ...kids: Child[]): HTMLElement {
  return h('section.panel', {}, h('h2', { text: title }), ...kids);
}

/** A small toast at the bottom of the window. */
export function toast(msg: string): void {
  const t = h('div.toast', { text: msg });
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), 1800);
  setTimeout(() => t.remove(), 2300);
}
