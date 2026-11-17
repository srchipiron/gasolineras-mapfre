// Utilidades geográficas compartidas entre servidor y navegador.

const R_EARTH_KM = 6371.0088;
const toRad = (d) => (d * Math.PI) / 180;

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Caja que contiene todos los puntos que están a menos de `km` de (lat, lon). */
export function bboxAround(lat, lon, km) {
  const dLat = km / 110.574;
  const dLon = km / (111.32 * Math.max(0.01, Math.cos(toRad(lat))));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLon: lon - dLon, maxLon: lon + dLon };
}

/** Caja de una polilínea [[lat, lon], ...] ampliada `padKm` kilómetros. */
export function bboxOfPolyline(poly, padKm = 0) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const [lat, lon] of poly) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  const midLat = (minLat + maxLat) / 2;
  const dLat = padKm / 110.574;
  const dLon = padKm / (111.32 * Math.max(0.01, Math.cos(toRad(midLat))));
  return { minLat: minLat - dLat, maxLat: maxLat + dLat, minLon: minLon - dLon, maxLon: maxLon + dLon };
}

export function inBbox(lat, lon, b) {
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

/** Km acumulados a lo largo de una polilínea (mismo tamaño que la polilínea). */
export function cumulativeKm(poly) {
  const out = new Array(poly.length);
  let acc = 0;
  out[0] = 0;
  for (let i = 1; i < poly.length; i++) {
    acc += haversineKm(poly[i - 1][0], poly[i - 1][1], poly[i][0], poly[i][1]);
    out[i] = acc;
  }
  return out;
}

/**
 * Distancia mínima (km) de un punto a una polilínea y km recorridos hasta el
 * punto de la ruta más cercano. Usa una proyección equirectangular local, que
 * es precisa de sobra para distancias de unos pocos km.
 */
export function distanceToPolyline(lat, lon, poly, cum = cumulativeKm(poly)) {
  if (poly.length === 0) return { distanceKm: Infinity, alongKm: 0 };
  if (poly.length === 1) {
    return { distanceKm: haversineKm(lat, lon, poly[0][0], poly[0][1]), alongKm: 0 };
  }
  const kx = 111.32 * Math.cos(toRad(lat));
  const ky = 110.574;
  let best = Infinity;
  let bestAlong = 0;
  for (let i = 1; i < poly.length; i++) {
    const ax = (poly[i - 1][1] - lon) * kx, ay = (poly[i - 1][0] - lat) * ky;
    const bx = (poly[i][1] - lon) * kx, by = (poly[i][0] - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy;
    const d = Math.sqrt(px * px + py * py);
    if (d < best) {
      best = d;
      bestAlong = cum[i - 1] + t * (cum[i] - cum[i - 1]);
    }
  }
  return { distanceKm: best, alongKm: bestAlong };
}

/** Simplificación Douglas-Peucker de una polilínea [[lat, lon]]; tolerancia en km. */
export function simplifyPolyline(poly, toleranceKm = 0.05) {
  if (poly.length <= 2) return poly.slice();
  const keep = new Uint8Array(poly.length);
  keep[0] = keep[poly.length - 1] = 1;
  const stack = [[0, poly.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    const seg = [poly[s], poly[e]];
    for (let i = s + 1; i < e; i++) {
      const d = distanceToPolyline(poly[i][0], poly[i][1], seg).distanceKm;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx !== -1 && maxD > toleranceKm) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return poly.filter((_, i) => keep[i]);
}
