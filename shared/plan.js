// Plan de repostajes en una ruta, «tipo Tesla»: con el depósito, el consumo y
// lo que llevas, dónde parar a llenar para gastar lo menos posible y no
// quedarte nunca por debajo de la reserva.
//
// Cada parada llena el depósito (así lo llevas siempre lleno). Se elige la
// combinación de paradas más barata con programación dinámica: el coste de
// una parada son los litros que repones por su precio (con tréboles si los
// da), más una pequeña penalización por parar para no proponer paradas de más
// por unos céntimos. Lo que gastas después de la última parada se valora al
// precio típico de la ruta (lo repondrás en algún sitio).

import { ROAD_FACTOR, RANGE_MARGIN } from './ranking.js';

/** € que «cuesta» parar una vez más (tiempo, quitarse el casco…). */
export const STOP_PENALTY = 0.6;

/** Una parada tiene que echar al menos esta parte del depósito (nada de parar a por 1 L). */
export const MIN_FILL = 0.35;

const round1 = (n) => Math.round(n * 10) / 10;

function median(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/**
 * @param {object[]} list resultados de la ruta (r.station.alongKm / offRouteKm, r.effective, r.price, r.open)
 * @param {object} o
 * @param {number} o.totalKm longitud de la ruta
 * @param {number} o.tankL capacidad del depósito (litros)
 * @param {number} o.consumption L/100 km
 * @param {number} [o.startKm] km de la ruta desde el que sales (p. ej. donde acabas de llenar)
 * @param {number} [o.startOffKm] desvío de ese punto a la ruta (si es una gasolinera)
 * @param {number} [o.startLitres] lo que llevas al salir (por defecto, lleno)
 * @param {(r) => number} [o.priceOf] precio que cuenta (por defecto r.effective)
 * @param {(r) => boolean} [o.isOpen] si estará abierta cuando pases (por defecto, si lo está ahora)
 */
export function planStops(list, { totalKm, tankL, consumption, startKm = 0, startOffKm = 0, startLitres = null, priceOf = (r) => r.effective, isOpen = (r) => r.open !== false, stopPenalty = STOP_PENALTY, minFill = MIN_FILL } = {}) {
  if (!(tankL > 0) || !(consumption > 0) || !(totalKm > 0)) return null;
  const perKm = consumption / 100;
  const reserve = tankL * (1 - RANGE_MARGIN);
  const fuel0 = Math.min(tankL, startLitres ?? tankL);
  const pos = (r) => r.station.alongKm ?? 0;
  const off = (r) => (r.station.offRouteKm ?? 0) * ROAD_FACTOR;
  const usable = list.filter((r) => Number.isFinite(priceOf(r)) && priceOf(r) > 0 && pos(r) > startKm + 0.5 && pos(r) < totalKm);
  const cands = usable.filter((r) => isOpen(r)).sort((a, b) => pos(a) - pos(b));
  // Las que se descartan por estar cerradas cuando pases.
  const closedSkipped = usable.length - cands.length;
  const refPrice = median(cands.map(priceOf)) || median(list.map(priceOf).filter((p) => p > 0)) || 0;

  // Nodo 0 = salida; 1..n = gasolineras.
  const n = cands.length;
  const at = [startKm, ...cands.map(pos)];
  const detour = [startOffKm * ROAD_FACTOR, ...cands.map(off)];
  const depart = [fuel0, ...cands.map(() => tankL)];
  const best = new Array(n + 1).fill(Infinity);
  const prev = new Array(n + 1).fill(-1);
  const arrive = new Array(n + 1).fill(0);
  best[0] = 0;
  const legKm = (i, j) => at[j] - at[i] + detour[i] + detour[j];
  for (let j = 1; j <= n; j++) {
    for (let i = 0; i < j; i++) {
      if (best[i] === Infinity) continue;
      const left = depart[i] - legKm(i, j) * perKm;
      if (left < reserve || tankL - left < tankL * minFill) continue;
      const c = best[i] + (tankL - left) * priceOf(cands[j - 1]) + stopPenalty;
      if (c < best[j]) { best[j] = c; prev[j] = i; arrive[j] = left; }
    }
  }
  // Llegada al final: lo que falta para llenar se valora al precio típico.
  let end = -1, endCost = Infinity, endLeft = 0;
  for (let i = 0; i <= n; i++) {
    if (best[i] === Infinity) continue;
    const left = depart[i] - (totalKm - at[i] + detour[i]) * perKm;
    if (left < reserve) continue;
    const c = best[i] + (tankL - left) * refPrice;
    if (c < endCost - 1e-9) { endCost = c; end = i; endLeft = left; }
  }

  const rangeKm = (fuel0 - reserve) / perKm;
  const emptyKm = round1(startKm + rangeKm - detour[0]);
  if (end === -1) {
    // No se llega: hasta dónde se puede llegar encadenando paradas.
    let far = startKm + rangeKm;
    for (let i = 1; i <= n; i++) if (best[i] < Infinity) far = Math.max(far, at[i] + (tankL - reserve) / perKm - detour[i]);
    return { ok: false, stops: [], emptyKm, rangeKm: round1(rangeKm), reachKm: round1(Math.min(far, totalKm)), endLitres: 0, cost: 0, litres: 0, refPrice, closedSkipped };
  }
  const path = [];
  for (let k = end; k > 0; k = prev[k]) path.unshift(k);
  const stops = path.map((k) => {
    const r = cands[k - 1];
    const fill = tankL - arrive[k];
    return { r, km: round1(at[k]), arriveL: round1(arrive[k]), fillL: round1(fill), cost: fill * priceOf(r), price: priceOf(r) };
  });
  return {
    ok: true,
    stops,
    emptyKm,
    rangeKm: round1(rangeKm),
    endLitres: round1(endLeft),
    cost: stops.reduce((s, x) => s + x.cost, 0),
    litres: stops.reduce((s, x) => s + x.fillL, 0),
    refPrice,
    closedSkipped,
  };
}

/**
 * Dónde estás en la ruta: km recorridos hasta el punto más cercano y a cuánto
 * queda. En las rutas circulares (o que pasan dos veces por el mismo sitio)
 * hay varios tramos igual de cerca: se elige el más cercano a `prevKm` (la
 * última posición conocida) o, si no hay, el primero.
 */
export function locateOnRoute(lat, lon, poly, cum, prevKm = null) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.574;
  const segs = [];
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const ax = (poly[i - 1][1] - lon) * kx, ay = (poly[i - 1][0] - lat) * ky;
    const bx = (poly[i][1] - lon) * kx, by = (poly[i][0] - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    segs.push({ d, along: cum[i - 1] + t * (cum[i] - cum[i - 1]) });
    if (d < best) best = d;
  }
  if (!segs.length) return { offKm: Infinity, km: 0 };
  const near = segs.filter((s) => s.d <= best + 0.5);
  const pick = prevKm == null
    ? near.reduce((a, b) => (b.along < a.along ? b : a))
    : near.reduce((a, b) => (Math.abs(b.along - prevKm) < Math.abs(a.along - prevKm) ? b : a));
  return { offKm: round1(pick.d), km: round1(pick.along) };
}

/**
 * Cómo vas con el plan en el km `posKm`: paradas hechas, la siguiente, a
 * cuántos km está y los litros que llevarás si has llenado donde decía el plan.
 */
export function routeProgress(plan, posKm, { tankL, consumption, totalKm }) {
  const startKm = plan?.start?.startKm ?? 0;
  const stops = plan?.stops ?? [];
  if (posKm < startKm - 0.5) return { before: true, posKm, startKm };
  const passed = stops.filter((s) => s.km <= posKm + 0.3);
  const refKm = Math.max(startKm, passed.length ? passed[passed.length - 1].km : 0);
  const fuelL = round1(Math.max(0, tankL - ((posKm - refKm) * consumption) / 100));
  const next = stops.find((s) => s.km > posKm + 0.3) ?? null;
  return {
    before: false,
    posKm,
    passed: passed.length,
    next,
    toNextKm: next ? round1(next.km - posKm) : null,
    toEndKm: round1(Math.max(0, totalKm - posKm)),
    fuelL,
    low: fuelL <= tankL * (1 - RANGE_MARGIN),
  };
}

/** Km antes de una parada del plan en que se avisa (modo «Seguir»). */
export const STOP_ALERT_KM = 5;

/**
 * Si toca avisar de la próxima parada: está a menos de `aheadKm` y aún no se
 * ha avisado de ella (`alerted`: claves ya avisadas, «km:id»). Devuelve la
 * clave a recordar o null.
 */
export function stopAlertKey(progress, alerted, aheadKm = STOP_ALERT_KM) {
  const n = progress?.next;
  if (!n || progress.toNextKm == null || progress.toNextKm > aheadKm) return null;
  const key = `${n.km}:${n.r?.station?.id ?? ''}`;
  return alerted.has(key) ? null : key;
}

/** Velocidad media por defecto en un track propio (moto por carreteras de curvas). */
export const DEFAULT_RIDE_KMH = 60;

/** Hora a la que pasas por el km `km` saliendo a `depart` desde `startKm`. */
export function arrivalAt(depart, km, { startKm = 0, kmh = DEFAULT_RIDE_KMH } = {}) {
  const h = Math.max(0, km - startKm) / (kmh > 0 ? kmh : DEFAULT_RIDE_KMH);
  return new Date(depart.getTime() + h * 3600000);
}

/**
 * Fecha de salida a partir de «HH:MM». Si esa hora ya pasó hace más de una
 * hora, es la de mañana (planificas la salida de mañana la noche antes).
 */
export function departureDate(hhmm, now = new Date()) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return { date: new Date(now), tomorrow: false };
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  let tomorrow = false;
  if (d.getTime() < now.getTime() - 3600000) { d.setDate(d.getDate() + 1); tomorrow = true; }
  return { date: d, tomorrow };
}
