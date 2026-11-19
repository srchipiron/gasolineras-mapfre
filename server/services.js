// Servicios externos: geocodificación (Nominatim/OpenStreetMap), rutas (OSRM)
// e histórico de precios (Ministerio). Todos con caché en memoria.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchJson, mapLimit } from './http.js';
import { parseResponse } from './minetur.js';
import { simplifyPolyline } from '../shared/geo.js';
import { NOMINATIM_URL, PHOTON_URL, nominatimUrl, photonUrl, parseNominatim, parsePhoton } from '../shared/geocode.js';

const USER_AGENT = 'GasolinerasClubMapfre/1.0 (aplicacion autoalojada)';

class LruCache {
  constructor(max = 500) {
    this.max = max;
    this.map = new Map();
  }
  get(k) {
    if (!this.map.has(k)) return undefined;
    const v = this.map.get(k);
    this.map.delete(k);
    this.map.set(k, v);
    return v;
  }
  set(k, v) {
    this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
  }
}

/**
 * Geocodificador limitado a España: Nominatim (1 petición/segundo) y, si falla
 * o limita las peticiones (429), Photon. Tras un 429 no se vuelve a probar
 * Nominatim durante `cooldownMs` para no empeorar el bloqueo.
 */
export function createGeocoder({
  baseUrl = NOMINATIM_URL, photonBaseUrl = PHOTON_URL, minIntervalMs = 1100, cooldownMs = 60000,
  fetchImpl = fetchJson, logger = console,
} = {}) {
  baseUrl ||= NOMINATIM_URL;
  photonBaseUrl ||= PHOTON_URL;
  const cache = new LruCache(500);
  let blockedUntil = 0;
  let last = 0;
  let queue = Promise.resolve();
  const throttle = () => {
    const p = queue.then(async () => {
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
    });
    queue = p.catch(() => {});
    return p;
  };
  return {
    async search(q) {
      const key = q.trim().toLowerCase();
      const hit = cache.get(key);
      if (hit) return hit;
      const opts = { headers: { 'User-Agent': USER_AGENT }, timeoutMs: 15000 };
      let results = null;
      let nominatimError = null;
      if (Date.now() >= blockedUntil) {
        await throttle();
        try {
          results = parseNominatim(await fetchImpl(nominatimUrl(q, baseUrl), opts));
        } catch (err) {
          nominatimError = err;
          if (err.status === 429) blockedUntil = Date.now() + cooldownMs;
          logger.warn?.(`Nominatim: ${err.message}; se prueba con Photon`);
        }
      }
      if (!results) {
        try {
          results = parsePhoton(await fetchImpl(photonUrl(q, photonBaseUrl), opts));
        } catch (err) {
          throw nominatimError ?? err;
        }
      }
      cache.set(key, results);
      return results;
    },
  };
}

/** Rutas en coche con OSRM. Devuelve la geometría simplificada [[lat, lon]]. */
export function createRouter({ baseUrl = 'https://router.project-osrm.org' } = {}) {
  const cache = new LruCache(100);
  return {
    async route(from, to) {
      const key = `${from.lat.toFixed(4)},${from.lon.toFixed(4)};${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const url =
        `${baseUrl}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}` +
        '?overview=full&geometries=geojson&alternatives=false&steps=false';
      const data = await fetchJson(url, { headers: { 'User-Agent': USER_AGENT }, timeoutMs: 20000 });
      const r = data?.routes?.[0];
      if (!r) throw new Error(data?.message || 'No se encontró ruta');
      const coords = r.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      const result = {
        distanceKm: r.distance / 1000,
        durationMin: r.duration / 60,
        polyline: simplifyPolyline(coords, 0.03),
      };
      cache.set(key, result);
      return result;
    },
  };
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Histórico de precios de una estación a partir de los datos diarios por
 * municipio del Ministerio. Los días pasados no cambian: se guardan en disco.
 */
export function createHistory({ client, cacheDir, logger = console }) {
  const mem = new LruCache(400);
  async function municipioDay(date, idMunicipio) {
    const key = `${dayKey(date)}_${idMunicipio}`;
    const hit = mem.get(key);
    if (hit) return hit;
    const file = cacheDir ? join(cacheDir, `${key}.json`) : null;
    if (file) {
      try {
        const data = JSON.parse(await readFile(file, 'utf8'));
        mem.set(key, data);
        return data;
      } catch {
        /* no está en disco */
      }
    }
    const parsed = parseResponse(await client.fetchHistMunicipio(date, idMunicipio));
    const byId = Object.fromEntries(parsed.stations.map((s) => [s.id, s.prices]));
    mem.set(key, byId);
    if (file) {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(file, JSON.stringify(byId)).catch(() => {});
    }
    return byId;
  }
  return {
    async forStation(station, days = 30, today = new Date()) {
      const dates = [];
      for (let i = days; i >= 1; i--) {
        dates.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
      }
      let failures = 0;
      const points = await mapLimit(dates, 4, async (d) => {
        try {
          const byId = await municipioDay(d, station.idMunicipio);
          return byId[station.id] ? { date: dayKey(d), prices: byId[station.id] } : null;
        } catch (err) {
          failures++;
          if (failures === 1) logger.warn?.(`Histórico ${dayKey(d)}: ${err.message}`);
          return null;
        }
      });
      const series = points.filter(Boolean);
      series.push({ date: dayKey(today), prices: station.prices });
      return { series, missingDays: failures };
    },
  };
}
