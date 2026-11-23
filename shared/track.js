// Tracks de rutas (GPX de Wikiloc, Calimoto, Kurviger, Google My Maps en KML…).
// Se leen con expresiones regulares para que funcione igual en el navegador y
// en los tests de Node, sin DOMParser.

import { cumulativeKm, simplifyPolyline } from './geo.js';

/** Como mucho tantos puntos se mandan al servidor (y se guardan). */
export const MAX_TRACK_POINTS = 1500;

const num = (s) => Number(String(s).trim());
const valid = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0);
const unescapeXml = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();

function firstName(xml) {
  const m = /<name>([\s\S]*?)<\/name>/i.exec(xml);
  return m ? unescapeXml(m[1]).slice(0, 60) : '';
}

function parseGpx(xml) {
  const pts = [];
  // Puntos de track (trkpt); si no hay, de ruta (rtept). Los waypoints sueltos no.
  for (const tag of ['trkpt', 'rtept']) {
    const re = new RegExp(`<(?:\\w+:)?${tag}\\b([^>]*)`, 'gi');
    let m;
    while ((m = re.exec(xml))) {
      const lat = num(/\blat\s*=\s*["']([^"']+)/i.exec(m[1])?.[1]);
      const lon = num(/\blon\s*=\s*["']([^"']+)/i.exec(m[1])?.[1]);
      if (valid(lat, lon)) pts.push([lat, lon]);
    }
    if (pts.length) break;
  }
  return pts;
}

function parseKml(xml) {
  const pts = [];
  // <LineString><coordinates>lon,lat[,alt] lon,lat…</coordinates> (y <gx:coord>lon lat alt</gx:coord>).
  const lines = xml.match(/<LineString\b[\s\S]*?<\/LineString>/gi) ?? [];
  for (const block of lines) {
    const c = /<coordinates>([\s\S]*?)<\/coordinates>/i.exec(block)?.[1] ?? '';
    for (const tuple of c.trim().split(/\s+/)) {
      const [lon, lat] = tuple.split(',').map(num);
      if (valid(lat, lon)) pts.push([lat, lon]);
    }
  }
  if (!pts.length) {
    const re = /<gx:coord>([^<]+)<\/gx:coord>/gi;
    let m;
    while ((m = re.exec(xml))) {
      const [lon, lat] = m[1].trim().split(/\s+/).map(num);
      if (valid(lat, lon)) pts.push([lat, lon]);
    }
  }
  return pts;
}

/** Quita puntos repetidos seguidos (los GPS graban muchos parados). */
function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > 1e-6 || Math.abs(q[1] - p[1]) > 1e-6) out.push(p);
  }
  return out;
}

/** Reduce el track hasta `max` puntos sin perder su forma (Douglas-Peucker). */
export function shrinkTrack(points, max = MAX_TRACK_POINTS) {
  let tol = 0.01;
  let out = points.length > max ? simplifyPolyline(points, tol) : points.slice();
  while (out.length > max && tol < 5) {
    tol *= 2;
    out = simplifyPolyline(points, tol);
  }
  return out.map(([la, lo]) => [Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5]);
}

/**
 * Lee un fichero GPX o KML. Devuelve { name, points: [[lat, lon]], distanceKm, loop }
 * o lanza un Error con un mensaje para el usuario.
 */
export function parseTrack(text, fileName = '') {
  const xml = String(text ?? '');
  const isKml = /<kml\b/i.test(xml) || /\.kml$/i.test(fileName);
  const isGpx = /<gpx\b/i.test(xml) || /\.gpx$/i.test(fileName);
  if (!isKml && !isGpx) throw new Error('No es un fichero GPX ni KML. Expórtalo como GPX desde tu app de rutas (Wikiloc, Calimoto, Kurviger…).');
  const raw = dedupe(isKml ? parseKml(xml) : parseGpx(xml));
  if (raw.length < 2) throw new Error('El fichero no trae ningún track con puntos.');
  const points = shrinkTrack(raw);
  const cum = cumulativeKm(points);
  const distanceKm = Math.round(cum[cum.length - 1] * 10) / 10;
  const [a, b] = [points[0], points[points.length - 1]];
  const loop = cumulativeKm([a, b])[1] < 1; // empieza y acaba en el mismo sitio
  const name = firstName(xml) || fileName.replace(/\.(gpx|kml|xml)$/i, '').slice(0, 60) || 'Mi ruta';
  return { name, points, distanceKm, loop };
}
