// Lista de gasolineras adheridas a Club MAPFRE: emparejado de las estaciones
// del localizador oficial (ver shared/locator.js) con las del Ministerio y
// lectura de la lista compartida config/adheridas.json.

import { readFile, stat } from 'node:fs/promises';
import { haversineKm } from '../shared/geo.js';
import { emptyOfficial, normalizeBrand } from '../shared/treboles.js';
export { parseLocatorPayload } from '../shared/locator.js';

function grid(stations, cell = 0.01) {
  const g = new Map();
  for (const s of stations) {
    const k = `${Math.floor(s.lat / cell)},${Math.floor(s.lon / cell)}`;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(s);
  }
  return { g, cell };
}

function nearbyCandidates({ g, cell }, lat, lon) {
  const ci = Math.floor(lat / cell), cj = Math.floor(lon / cell);
  const out = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(g.get(`${ci + i},${cj + j}`) ?? []));
  return out;
}

function sharesWord(a, b) {
  const wa = new Set(normalizeBrand(a).split(' ').filter((w) => w.length >= 3));
  return normalizeBrand(b).split(' ').some((w) => w.length >= 3 && wa.has(w));
}

/**
 * Empareja cada estación del localizador con la del Ministerio más cercana.
 * Acepta hasta `maxM` metros, o hasta `maxM * 2` si el nombre coincide.
 */
export function matchEntries(entries, stations, { maxM = 250 } = {}) {
  const index = grid(stations);
  const matched = [];
  const unmatched = [];
  const used = new Map();
  for (const e of entries) {
    let best = null;
    for (const s of nearbyCandidates(index, e.lat, e.lon)) {
      const d = haversineKm(e.lat, e.lon, s.lat, s.lon) * 1000;
      const nameOk = sharesWord(e.nombre, s.brand) || sharesWord(e.direccion, s.address);
      const limit = nameOk ? maxM * 2 : maxM;
      if (d > limit) continue;
      const score = d - (nameOk ? 150 : 0);
      if (!best || score < best.score) best = { s, d, score, nameOk };
    }
    if (!best) {
      unmatched.push(e);
      continue;
    }
    const prev = used.get(best.s.id);
    if (prev && prev.distanceM <= best.d) continue; // ya emparejada con otra más cercana
    const m = {
      id: best.s.id,
      tipo: e.tipo,
      nombre: e.nombre,
      ventajas: e.ventajas || '',
      distanceM: Math.round(best.d),
      brand: best.s.brand,
      address: best.s.address,
      locality: best.s.locality,
      province: best.s.province,
      idProvincia: best.s.idProvincia,
    };
    if (prev) matched.splice(matched.indexOf(prev), 1);
    used.set(best.s.id, m);
    matched.push(m);
  }
  return { matched, unmatched };
}

/** Resumen por provincia de un emparejado. */
export function provinceSummary(matched) {
  const by = {};
  for (const m of matched) {
    const p = (by[m.idProvincia] ??= { idProvincia: m.idProvincia, province: m.province, count: 0 });
    p.count++;
  }
  return Object.values(by).sort((a, b) => a.idProvincia.localeCompare(b.idProvincia));
}

/** Valida y normaliza una lista oficial (config/adheridas.json). */
export function normalizeOfficial(data) {
  const out = emptyOfficial();
  if (!data || typeof data !== 'object') return out;
  out.updatedAt = typeof data.updatedAt === 'string' ? data.updatedAt : null;
  out.source = typeof data.source === 'string' ? data.source : '';
  out.provinces = Array.isArray(data.provinces) ? data.provinces.filter((p) => /^\d{2}$/.test(p)) : [];
  for (const [id, v] of Object.entries(data.stations ?? {})) {
    if (!/^[A-Za-z0-9]{1,20}$/.test(id)) continue;
    out.stations[id] = {
      tipo: ['repsol', 'colaboradora', 'manual'].includes(v?.tipo) ? v.tipo : 'colaboradora',
      nombre: String(v?.nombre ?? '').slice(0, 120),
      ...(v?.ventajas ? { ventajas: String(v.ventajas).slice(0, 300) } : {}),
    };
  }
  return out;
}

/** Lee config/adheridas.json y lo vuelve a leer si cambia. */
export function createOfficialSource(file) {
  let cache = { mtimeMs: -1, data: emptyOfficial() };
  return {
    async get() {
      try {
        const s = await stat(file);
        if (s.mtimeMs !== cache.mtimeMs) {
          cache = { mtimeMs: s.mtimeMs, data: normalizeOfficial(JSON.parse(await readFile(file, 'utf8'))) };
        }
      } catch {
        cache = { mtimeMs: -1, data: emptyOfficial() };
      }
      return cache.data;
    },
  };
}
