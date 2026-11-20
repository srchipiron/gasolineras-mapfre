// Formato de números y textos (es-ES) y escapado de HTML.

const nf = (d) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const NF3 = nf(3), NF2 = nf(2), NF1 = nf(1), NF0 = nf(0);

export const eurL = (n) => (n == null ? '—' : `${NF3.format(n)} €`);
export const eur = (n) => (n == null ? '—' : `${NF2.format(n)} €`);
export const eur0 = (n) => (n == null ? '—' : `${NF0.format(n)} €`);
export const num2 = (n) => (n == null ? '—' : NF2.format(n));
export const num3 = (n) => (n == null ? '—' : NF3.format(n));
export const pct = (n) => `${NF0.format(n)} %`;

/** Variación de precio en céntimos: «▼ 1,2 cts», «▲ 0,5 cts» o «= ». */
export function cents(delta) {
  if (delta == null) return '';
  const c = Math.round(delta * 1000) / 10;
  if (c === 0) return '= ayer';
  return `${c < 0 ? '▼' : '▲'} ${NF1.format(Math.abs(c))} cts`;
}

export function km(n) {
  if (n == null) return '';
  if (n < 1) return `${NF0.format(Math.round(n * 1000 / 10) * 10)} m`;
  return `${n < 10 ? NF1.format(n) : NF0.format(n)} km`;
}

export function duration(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

/**
 * Fecha del Ministerio («19/11/2026 18:33:27», hora de Madrid) -> Date.
 * Antes de las 10 escribe la hora con una sola cifra: «20/11/2026 6:39:42».
 */
export function parseFecha(fecha) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(fecha ?? '');
  return m ? new Date(+m[3], m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0)) : null;
}

export function date(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Plantilla HTML que escapa automáticamente los valores interpolados. */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += (v instanceof Raw ? v.value : Array.isArray(v) ? v.map((x) => (x instanceof Raw ? x.value : esc(x))).join('') : esc(v)) + strings[i + 1];
  });
  return new Raw(out);
}
class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}
export const raw = (s) => new Raw(s);

export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
