// Cálculo de resultados: precio efectivo con tréboles, coste real del
// repostaje (incluido el desvío), filtros, orden y estadísticas.

import { findRule, percentFor, treblesFor, fuelEligible, eligibleAmount, isApprox } from './treboles.js';
import { isOpenAt, parseSchedule } from './horario.js';

// Los km por carretera suelen ser ~30 % más que en línea recta.
export const ROAD_FACTOR = 1.3;

export const SORTS = {
  effective: 'Con tréboles',
  price: 'Surtidor',
  total: 'Coste real',
  distance: 'Distancia',
};

/**
 * Enriquece cada estación con los datos del carburante elegido.
 * @param {object[]} stations estaciones con `prices` y `distanceKm` (o `offRouteKm`)
 * @param {object} opts { fuel, program, overrides, official, litres, consumption, now, capLeft }
 *   capLeft: euros que aún dan tréboles hoy (tope de 100 €/día y 300 €/semana)
 */
export function enrich(stations, opts) {
  const {
    fuel, program, overrides = {}, official = null, litres = 40, consumption = 6.5, now = new Date(), capLeft = Infinity,
  } = opts;
  const trebolValue = program?.trebolValue ?? 1;
  const eligibleFuel = fuelEligible(program, fuel);
  const out = [];
  for (const st of stations) {
    const price = st.prices?.[fuel];
    if (price == null) continue;
    const rule = findRule(st, program, overrides, official);
    // El GLP y el GNC no dan tréboles aunque la estación esté adherida.
    const pct = eligibleFuel ? percentFor(rule, now) : 0;
    const amount = litres * price;
    // Solo da tréboles la parte del importe que cabe en el tope.
    // La Tarjeta Repsol Carburante no tiene el tope del carnet.
    const eligible = rule?.noCap ? amount : Math.max(0, Math.min(eligibleAmount(amount, program), capLeft));
    const share = amount > 0 ? eligible / amount : 0;
    const eff = price * (1 - (pct / 100) * trebolValue * share);
    const detourKm = (st.offRouteKm ?? st.distanceKm ?? 0) * 2 * ROAD_FACTOR;
    const detourCost = (detourKm * consumption / 100) * price;
    const fillCost = litres * eff;
    const week = parseSchedule(st.schedule);
    // Variación frente a ayer (si el servidor conoce los precios de ayer).
    const prevPrice = st.prev?.[fuel];
    const change = prevPrice != null ? Math.round((price - prevPrice) * 1000) / 1000 : null;
    out.push({
      station: st,
      price,
      rule,
      mapfre: !!rule && pct > 0,
      adherida: !!rule,
      tipo: rule?.source === 'manual' ? 'manual' : rule?.tipo ?? null,
      approx: isApprox(rule),
      percent: pct,
      effective: eff,
      treboles: rule ? treblesFor(eligible, pct) : 0,
      cappedBy: eligible < amount ? amount - eligible : 0,
      detourKm,
      detourCost,
      totalCost: fillCost + detourCost,
      open: isOpenAt(week, now),
      change,
    });
  }
  return out;
}

/** Tipos del mapa oficial, con los mismos nombres que su desplegable. */
export const OFFICIAL_FILTERS = {
  all: 'Todas las adheridas',
  colaboradora: 'Más EESS colaboradoras',
  repsol: 'Gasolinera Repsol',
};

export function filterResults(list, { onlyMapfre = false, openNow = false, hideRestricted = true, tipo = 'all' } = {}) {
  return list.filter((r) => {
    if (onlyMapfre && !r.mapfre) return false;
    // Como en el mapa oficial: «Más EESS colaboradoras» o «Gasolinera Repsol».
    // Las que marcas tú a mano se ven siempre.
    if (tipo !== 'all' && !inOfficialFilter(r, tipo)) return false;
    if (openNow && r.open === false) return false;
    if (hideRestricted && r.station.saleType === 'R') return false;
    return true;
  });
}

const dist = (r) => r.station.offRouteKm ?? r.station.distanceKm ?? 0;
const COMPARATORS = {
  effective: (a, b) => a.effective - b.effective || a.price - b.price || dist(a) - dist(b),
  price: (a, b) => a.price - b.price || dist(a) - dist(b),
  total: (a, b) => a.totalCost - b.totalCost || dist(a) - dist(b),
  distance: (a, b) => dist(a) - dist(b) || a.effective - b.effective,
  along: (a, b) => (a.station.alongKm ?? 0) - (b.station.alongKm ?? 0),
};

export function sortResults(list, sort = 'effective') {
  return list.slice().sort(COMPARATORS[sort] ?? COMPARATORS.effective);
}

function minBy(list, key) {
  let best = null;
  for (const r of list) if (!best || r[key] < best[key]) best = r;
  return best;
}

/** Estadísticas de la zona y mejores opciones. */
export function summarize(list) {
  if (!list.length) return { count: 0 };
  const prices = list.map((r) => r.price).sort((a, b) => a - b);
  const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
  const mapfreList = list.filter((r) => r.mapfre);
  const changes = list.map((r) => r.change).filter((c) => c != null);
  const nonMapfre = list.filter((r) => !r.mapfre);
  return {
    count: list.length,
    mapfreCount: mapfreList.length,
    min: prices[0],
    max: prices[prices.length - 1],
    avg,
    median: prices[Math.floor(prices.length / 2)],
    p33: prices[Math.floor((prices.length - 1) / 3)],
    p66: prices[Math.floor(((prices.length - 1) * 2) / 3)],
    bestEffective: minBy(list, 'effective'),
    bestMapfre: minBy(mapfreList, 'effective'),
    bestNonMapfre: minBy(nonMapfre, 'price'),
    bestTotal: minBy(list, 'totalCost'),
    avgChange: changes.length ? changes.reduce((a, c) => a + c, 0) / changes.length : null,
    changedUp: changes.filter((c) => c > 0).length,
    changedDown: changes.filter((c) => c < 0).length,
  };
}

/** ¿La gasolinera entra en el filtro de tipo del mapa oficial? */
export function inOfficialFilter(r, tipo = 'all') {
  return r.mapfre && (tipo === 'all' || r.tipo === tipo || r.tipo === 'manual');
}

/**
 * ¿Merecen la pena los tréboles? Compara la mejor gasolinera del filtro
 * (adheridas del tipo elegido) con la mejor de fuera del filtro, por coste
 * real: lo que pagas por tus litros ya descontados los tréboles, más el
 * combustible del desvío de ida y vuelta. Así cuentan el precio y la distancia.
 * `list` debe incluir todas las gasolineras, no solo las del filtro.
 */
export function compareFilter(list, { tipo = 'all' } = {}) {
  const inside = list.filter((r) => inOfficialFilter(r, tipo));
  const outside = list.filter((r) => !inOfficialFilter(r, tipo));
  const bestIn = minBy(inside, 'totalCost');
  const bestOut = minBy(outside, 'totalCost');
  return {
    bestIn,
    bestOut,
    saving: bestIn && bestOut ? bestOut.totalCost - bestIn.totalCost : null,
    insideCount: inside.length,
    outsideCount: outside.length,
  };
}

/** Categoría de precio para colorear: 'cheap' | 'mid' | 'expensive'. */
export function priceLevel(price, summary) {
  if (!summary || !summary.count || price == null) return 'mid';
  if (price <= summary.p33) return 'cheap';
  if (price > summary.p66) return 'expensive';
  return 'mid';
}
