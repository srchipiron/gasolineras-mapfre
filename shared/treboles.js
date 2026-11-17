// Reglas del programa "Ahorro al Repostar" de Club MAPFRE y cálculo de tréboles.
//
// Condiciones publicadas por Club MAPFRE (comprobadas en noviembre de 2026):
//   - 6 % del importe en tréboles los días 1 a 5 de cada mes y 3 % el resto.
//   - 1 trébol = 1 € de descuento en tu seguro MAPFRE.
//   - Oferta válida hasta el 31/12/2026; no acumulable con otros descuentos
//     de la estación (MundoGalp, Waylet...).
// La lista exacta de estaciones adheridas solo está en el localizador oficial,
// así que la app trabaja por marcas (configurable) y permite marcar a mano
// cualquier estación como adherida o no adherida.

export const DEFAULT_PROGRAM = Object.freeze({
  version: 1,
  trebolValue: 1, // € de descuento en el seguro por cada trébol
  validUntil: '2026-12-31',
  rules: [
    {
      id: 'galp',
      name: 'Galp',
      match: ['GALP'],
      percent: 3,
      boostPercent: 6,
      boostFromDay: 1,
      boostToDay: 5,
      enabled: true,
      requirement: 'Identifícate con el carnet o la app de Club MAPFRE antes de pagar.',
    },
    {
      id: 'repsol',
      name: 'Repsol (con Tarjeta Repsol Carburante)',
      match: ['REPSOL'],
      percent: 3,
      boostPercent: 6,
      boostFromDay: 1,
      boostToDay: 5,
      enabled: false,
      requirement: 'Paga con la Tarjeta Repsol Carburante vinculada a Club MAPFRE.',
    },
    {
      id: 'moeve',
      name: 'Moeve / Cepsa (solo algunas estaciones)',
      match: ['MOEVE', 'CEPSA'],
      percent: 3,
      boostPercent: 6,
      boostFromDay: 1,
      boostToDay: 5,
      enabled: false,
      requirement: 'Solo algunas estaciones están adheridas: compruébalo en el localizador de Club MAPFRE.',
    },
  ],
  // Regla que se aplica a las estaciones que marcas tú como adheridas.
  manual: {
    id: 'manual',
    name: 'Adherida (marcada por ti)',
    percent: 3,
    boostPercent: 6,
    boostFromDay: 1,
    boostToDay: 5,
    requirement: 'Estación marcada manualmente como adherida a Club MAPFRE.',
  },
});

export function cloneProgram(p = DEFAULT_PROGRAM) {
  return JSON.parse(JSON.stringify(p));
}

/** Normaliza un rótulo: sin tildes, mayúsculas y solo letras/números. */
export function normalizeBrand(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** ¿El rótulo contiene el patrón como palabra(s) completa(s)? */
export function brandMatches(brand, pattern) {
  const b = ` ${normalizeBrand(brand)} `;
  const p = normalizeBrand(pattern);
  return p.length > 0 && b.includes(` ${p} `);
}

/**
 * Regla MAPFRE aplicable a una estación, o null si no está adherida.
 * overrides: { [idEstacion]: 'in' | 'out' } (marcas manuales del usuario).
 */
export function findRule(station, program = DEFAULT_PROGRAM, overrides = {}) {
  const ov = overrides?.[station.id];
  if (ov === 'out') return null;
  if (ov === 'in') return program.manual ?? DEFAULT_PROGRAM.manual;
  for (const rule of program.rules ?? []) {
    if (!rule.enabled) continue;
    if ((rule.match ?? []).some((p) => brandMatches(station.brand, p))) return rule;
  }
  return null;
}

export function isBoostDay(rule, date = new Date()) {
  if (!rule) return false;
  const d = date.getDate();
  return d >= (rule.boostFromDay ?? 1) && d <= (rule.boostToDay ?? 0);
}

/** Porcentaje devuelto en tréboles para esa regla en esa fecha. */
export function percentFor(rule, date = new Date()) {
  if (!rule) return 0;
  return isBoostDay(rule, date) ? rule.boostPercent ?? rule.percent : rule.percent;
}

/** Precio efectivo por litro descontando el valor de los tréboles. */
export function effectivePrice(price, percent, trebolValue = 1) {
  if (price == null) return null;
  return price * (1 - (percent / 100) * trebolValue);
}

/** Tréboles que se obtienen por un importe en euros. */
export function treblesFor(amountEur, percent) {
  return Math.round(amountEur * percent) / 100;
}

/** Días que faltan para el próximo periodo de bonificación (0 si es hoy). */
export function daysUntilBoost(rule = DEFAULT_PROGRAM.rules[0], date = new Date()) {
  if (isBoostDay(rule, date)) return 0;
  const from = rule.boostFromDay ?? 1;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let target = new Date(d.getFullYear(), d.getMonth(), from);
  if (target <= d) target = new Date(d.getFullYear(), d.getMonth() + 1, from);
  return Math.round((target - d) / 86400000);
}

export function programExpired(program = DEFAULT_PROGRAM, date = new Date()) {
  if (!program.validUntil) return false;
  return date > new Date(`${program.validUntil}T23:59:59`);
}
