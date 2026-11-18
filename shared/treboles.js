// Reglas del programa "Ahorro al Repostar" de Club MAPFRE y cálculo de tréboles.
//
// Condiciones publicadas por Club MAPFRE (comprobadas el 18/11/2026 en
// mapfretecuidamos.com/particulares/ahorro-y-treboles/ahorro-al-repostar/):
//   - 6 % del repostaje en tréboles del día 1 al 5 de cada mes y 3 % el resto.
//   - 1 trébol = 1 € de descuento en tu seguro MAPFRE.
//   - Tope: compra máxima de 100 € al día o 300 € en la misma semana.
//   - Excluidos: GLP y GNC, y vehículos de más de 3.500 kg de uso no particular.
//   - Solo en estaciones adheridas con personal al que enseñar el carnet.
//   - No acumulable con otros descuentos de la estación (MundoGalp, Waylet...).
//   - Válida hasta el 31/12/2026.
// Qué gasolineras dan tréboles: SOLO las de la lista oficial del mapa de
// Club MAPFRE (importada desde un HAR o una respuesta del localizador) y las
// que marca el propio usuario. No hay reglas por marca: nada se deduce de
// fuentes externas.

export const DEFAULT_PROGRAM = Object.freeze({
  version: 4,
  trebolValue: 1, // € de descuento en el seguro por cada trébol
  validUntil: '2026-12-31',
  excludedFuels: ['glp', 'gnc'],
  cap: { perDay: 100, perWeek: 300 },
  requirement:
    'Enseña tu carnet de socio de Club MAPFRE (o la app) al pagar en caja. Solo en estaciones adheridas con personal de atención.',
  promos: [
    {
      from: '2026-11-01',
      to: '2026-11-30',
      text: '15 tréboles extra en tu primer repostaje de 2026 (mínimo 20 €).',
    },
  ],
  officialMapUrl: 'https://www.mapfretecuidamos.com/gasolineras/',
  // Porcentajes de las estaciones de la lista oficial.
  official: { id: 'official', percent: 3, boostPercent: 6, boostFromDay: 1, boostToDay: 5 },
  rules: [], // sin reglas por marca: solo la lista oficial y tus marcas
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

export const TIPOS = {
  repsol: 'Gasolinera Repsol',
  colaboradora: 'EESS colaboradora',
  manual: 'Añadida a mano',
};

export function cloneProgram(p = DEFAULT_PROGRAM) {
  return JSON.parse(JSON.stringify(p));
}

/**
 * Mezcla las reglas guardadas en el navegador con las de fábrica. Si las de
 * fábrica cambian de versión (porque cambió el programa de Club MAPFRE), se
 * descartan las guardadas y solo se conservan el valor del trébol y las
 * reglas que añadiste tú.
 */
export function migrateProgram(saved) {
  const base = cloneProgram(DEFAULT_PROGRAM);
  if (!saved || typeof saved !== 'object') return base;
  const trebolValue = Number.isFinite(saved.trebolValue) ? saved.trebolValue : base.trebolValue;
  // Al cambiar de versión se descartan todas las reglas por marca guardadas.
  if (saved.version !== base.version) return { ...base, trebolValue, rules: [...base.rules] };
  const custom = (saved.rules ?? []).filter((r) => String(r.id).startsWith('custom-'));
  const editable = ['enabled', 'match', 'percent', 'boostPercent', 'boostFromDay', 'boostToDay'];
  const rules = base.rules.map((r) => {
    const s = (saved.rules ?? []).find((x) => x.id === r.id);
    if (!s) return r;
    return { ...r, ...Object.fromEntries(editable.filter((k) => s[k] !== undefined).map((k) => [k, s[k]])) };
  });
  return { ...base, trebolValue, rules: [...rules, ...custom] };
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

/** Lista oficial vacía. `stations`: { idEstacion: { tipo, nombre } }. */
export function emptyOfficial() {
  return { version: 1, updatedAt: null, source: '', provinces: [], stations: {} };
}

/** ¿La lista oficial cubre por completo la provincia de esta estación? */
export function officialCovers(official, station) {
  return !!official && Array.isArray(official.provinces) && official.provinces.includes(station.idProvincia);
}

/** Une varias listas oficiales (p. ej. la del servidor y la importada en este dispositivo). */
export function mergeOfficial(...lists) {
  const out = emptyOfficial();
  const provinces = new Set();
  for (const l of lists) {
    if (!l) continue;
    for (const p of l.provinces ?? []) provinces.add(p);
    Object.assign(out.stations, l.stations ?? {});
    if (l.updatedAt && (!out.updatedAt || l.updatedAt > out.updatedAt)) out.updatedAt = l.updatedAt;
  }
  out.provinces = [...provinces].sort();
  return out;
}

/**
 * Regla MAPFRE aplicable a una estación, o null si no está adherida.
 * Prioridad: tus marcas manuales > lista oficial (en las provincias que cubre)
 * > reglas por marca.
 * @param {object} station
 * @param {object} program reglas (DEFAULT_PROGRAM o las de Ajustes)
 * @param {object} overrides { idEstacion: 'in' | 'out' }
 * @param {object} official lista oficial importada
 */
export function findRule(station, program = DEFAULT_PROGRAM, overrides = {}, official = null) {
  const ov = overrides?.[station.id];
  if (ov === 'out') return null;
  if (ov === 'in') return { ...(program.manual ?? DEFAULT_PROGRAM.manual), source: 'manual' };
  const hit = official?.stations?.[station.id];
  if (hit) {
    const base = {
      ...(program.official ?? DEFAULT_PROGRAM.official),
      name: `Lista oficial · ${TIPOS[hit.tipo] ?? 'EESS colaboradora'}`,
      requirement: program.requirement ?? DEFAULT_PROGRAM.requirement,
      ventajas: hit.ventajas || '',
      source: 'official',
    };
    // Porcentaje indicado por el mapa oficial para esta estación:
    //  - «Hasta un 6 %…»: es el máximo del carnet -> condiciones del carnet.
    //  - un único porcentaje («6 % con la tarjeta…»): ese, todos los días.
    //  - dos («6 % del 1 al 5 y 3 % el resto»): el mayor los días bonificados.
    const pcts = /hasta/i.test(hit.ventajas ?? '') ? [] : percentsIn(hit.ventajas);
    if (pcts.length === 1) return { ...base, percent: pcts[0], boostPercent: pcts[0], promos: [] };
    if (pcts.length >= 2) return { ...base, percent: Math.min(...pcts), boostPercent: Math.max(...pcts), promos: [] };
    return base;
  }
  if (officialCovers(official, station)) return null;
  for (const rule of program.rules ?? []) {
    if (!rule.enabled) continue;
    if (rule.excludeProvinces?.includes(station.idProvincia)) continue;
    if ((rule.match ?? []).some((p) => brandMatches(station.brand, p))) return { ...rule, source: 'brand' };
  }
  return null;
}

/** Porcentajes que aparecen en un texto («6 % en Tréboles…» -> [6]). */
export function percentsIn(text) {
  return [...String(text ?? '').matchAll(/(\d{1,2}(?:[.,]\d+)?)\s*%/g)]
    .map((m) => Number(m[1].replace(',', '.')))
    .filter((n) => n > 0 && n <= 50);
}

/** ¿La regla es una aproximación (no confirmada por condiciones publicadas)? */
export function isApprox(rule) {
  return rule?.source === 'brand' && rule.confidence !== 'alta';
}

/** ¿Ese carburante da tréboles? (el GLP y el GNC están excluidos) */
export function fuelEligible(program, fuel) {
  return !(program?.excludedFuels ?? DEFAULT_PROGRAM.excludedFuels).includes(fuel);
}

export function isBoostDay(rule, date = new Date()) {
  if (!rule) return false;
  const d = date.getDate();
  return d >= (rule.boostFromDay ?? 1) && d <= (rule.boostToDay ?? 0);
}

/** Porcentaje devuelto en tréboles para esa regla en esa fecha. */
export function percentFor(rule, date = new Date()) {
  if (!rule) return 0;
  const today = isoDay(date);
  const promo = (rule.promos ?? []).find((p) => p.from <= today && today <= p.to && p.percent != null);
  if (promo) return promo.percent;
  return isBoostDay(rule, date) ? rule.boostPercent ?? rule.percent : rule.percent;
}

/** Parte del importe que da tréboles con el tope diario (100 € por defecto). */
export function eligibleAmount(amountEur, program = DEFAULT_PROGRAM) {
  const cap = program?.cap?.perDay;
  return cap ? Math.min(amountEur, cap) : amountEur;
}

/**
 * Precio efectivo por litro descontando el valor de los tréboles.
 * Si se indica el importe del repostaje, aplica el tope diario.
 */
export function effectivePrice(price, percent, trebolValue = 1, { amountEur, program } = {}) {
  if (price == null) return null;
  let share = 1;
  if (amountEur > 0 && program?.cap?.perDay) share = eligibleAmount(amountEur, program) / amountEur;
  return price * (1 - (percent / 100) * trebolValue * share);
}

/** Tréboles que se obtienen por un importe en euros. */
export function treblesFor(amountEur, percent) {
  return Math.round(amountEur * percent) / 100;
}

export function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lunes de la semana de una fecha "aaaa-mm-dd". */
export function weekStart(dateISO) {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDay(d);
}

/**
 * Uso del tope de tréboles en una fecha según el registro de repostajes:
 * cuánto se ha repostado con tréboles ese día (máx. 100 €) y esa semana de
 * lunes a domingo (máx. 300 €), y cuánto queda.
 */
export function capStatus(dateISO, log = [], program = DEFAULT_PROGRAM) {
  const cap = program?.cap ?? {};
  const week = weekStart(dateISO);
  let day = 0, wk = 0;
  for (const e of log) {
    if (!e?.mapfre || !e.date) continue;
    const a = e.eligibleAmount ?? e.amount ?? 0;
    if (e.date === dateISO) day += a;
    if (weekStart(e.date) === week) wk += a;
  }
  const dayLeft = cap.perDay ? Math.max(0, cap.perDay - day) : Infinity;
  const weekLeft = cap.perWeek ? Math.max(0, cap.perWeek - wk) : Infinity;
  return {
    day: { used: day, cap: cap.perDay ?? null, left: dayLeft },
    week: { used: wk, cap: cap.perWeek ?? null, left: weekLeft },
    left: Math.min(dayLeft, weekLeft),
  };
}

/** Importe de un repostaje nuevo que da tréboles, con el tope diario y semanal. */
export function cappedAmount(amountEur, dateISO, log = [], program = DEFAULT_PROGRAM) {
  return Math.max(0, Math.min(amountEur, capStatus(dateISO, log, program).left));
}

/**
 * ¿Compensa esperar al periodo del 6 %? Devuelve, para un repostaje de
 * `litres` a `price`, cuántos tréboles más se ganan en los días bonificados.
 */
export function waitAdvice({ price, litres, program = DEFAULT_PROGRAM, now = new Date() }) {
  const rule = program?.official ?? DEFAULT_PROGRAM.official;
  const extraPct = (rule.boostPercent ?? rule.percent) - rule.percent;
  const extra = treblesFor(eligibleAmount(price * litres, program), extraPct);
  if (isBoostDay(rule, now)) {
    return { boostNow: true, daysLeft: rule.boostToDay - now.getDate() + 1, extra, percent: rule.boostPercent };
  }
  const days = daysUntilBoost(rule, now);
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return { boostNow: false, days, extra, percent: rule.boostPercent, nextBoost: isoDay(next) };
}

/** Días que faltan para el próximo periodo de bonificación (0 si es hoy). */
export function daysUntilBoost(rule = DEFAULT_PROGRAM.official, date = new Date()) {
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

/** Promociones vigentes en esa fecha. */
export function activePromos(program = DEFAULT_PROGRAM, date = new Date()) {
  const today = isoDay(date);
  return (program.promos ?? DEFAULT_PROGRAM.promos ?? []).filter((p) => p.from <= today && today <= p.to);
}

export const DAYS_TO_ARRIVE = 10; // «Recibirás los Tréboles antes de 10 días naturales»
export const DAYS_TO_CLAIM = 30; // No se admiten tickets de más de 30 días

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

/**
 * Estado de los tréboles de un repostaje registrado:
 *  - waiting: aún no han pasado 10 días (until = fecha límite de llegada)
 *  - ask: han pasado 10 días y no has dicho si llegaron
 *  - ok: llegaron
 *  - claim: no llegaron; se pueden reclamar hasta 30 días después
 */
export function trebolStatus(entry, todayISO) {
  if (!entry?.mapfre || !(entry.treboles > 0)) return null;
  if (entry.confirmed === true) return { kind: 'ok' };
  const age = Math.round((new Date(`${todayISO}T12:00:00`) - new Date(`${entry.date}T12:00:00`)) / 86400000);
  if (entry.confirmed === false) {
    return { kind: 'claim', claimUntil: addDaysISO(entry.date, DAYS_TO_CLAIM), left: DAYS_TO_CLAIM - age };
  }
  if (age < DAYS_TO_ARRIVE) return { kind: 'waiting', until: addDaysISO(entry.date, DAYS_TO_ARRIVE) };
  return { kind: 'ask', left: DAYS_TO_CLAIM - age };
}
