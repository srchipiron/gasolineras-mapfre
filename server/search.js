// Búsquedas espaciales sobre la lista de estaciones.

import { haversineKm, bboxAround, bboxOfPolyline, inBbox, cumulativeKm, distanceToPolyline } from '../shared/geo.js';

function passes(st, { fuel, publicOnly }) {
  if (fuel && st.prices[fuel] == null) return false;
  if (publicOnly && st.saleType === 'R') return false;
  return true;
}

/** Estaciones a menos de `radiusKm` de (lat, lon), ordenadas por distancia. */
export function nearby(stations, { lat, lon, radiusKm = 10, fuel, publicOnly = false, limit = 400 }) {
  const box = bboxAround(lat, lon, radiusKm);
  const out = [];
  for (const st of stations) {
    if (!inBbox(st.lat, st.lon, box) || !passes(st, { fuel, publicOnly })) continue;
    const d = haversineKm(lat, lon, st.lat, st.lon);
    if (d <= radiusKm) out.push({ ...st, distanceKm: round(d, 3) });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, limit);
}

/**
 * Estaciones a menos de `corridorKm` de una ruta [[lat, lon], ...].
 * Añade `offRouteKm` (distancia a la ruta) y `alongKm` (km desde el origen).
 */
export function alongRoute(stations, polyline, { corridorKm = 2, fuel, publicOnly = false, limit = 600 } = {}) {
  if (!polyline?.length) return [];
  const box = bboxOfPolyline(polyline, corridorKm);
  const cum = cumulativeKm(polyline);
  const out = [];
  for (const st of stations) {
    if (!inBbox(st.lat, st.lon, box) || !passes(st, { fuel, publicOnly })) continue;
    const { distanceKm, alongKm } = distanceToPolyline(st.lat, st.lon, polyline, cum);
    if (distanceKm <= corridorKm) {
      out.push({ ...st, offRouteKm: round(distanceKm, 3), alongKm: round(alongKm, 2) });
    }
  }
  out.sort((a, b) => a.alongKm - b.alongKm);
  return out.slice(0, limit);
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
