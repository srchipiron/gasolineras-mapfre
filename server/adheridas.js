// Lista de gasolineras adheridas a Club MAPFRE: emparejado de las estaciones
// del localizador oficial (ver shared/locator.js) con las del Ministerio y
// lectura de la lista compartida config/adheridas.json.

import { readFile, stat } from 'node:fs/promises';
import { haversineKm } from '../shared/geo.js';
import { emptyOfficial, normalizeBrand, brandConflict } from '../shared/treboles.js';
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

// Palabras que no ayudan a identificar una gasolinera.
const STOP = new Set([
  'CALLE', 'CL', 'C', 'AVENIDA', 'AVDA', 'AVD', 'AV', 'CARRETERA', 'CTRA', 'CR', 'CRTA', 'PASEO', 'PS', 'PLAZA',
  'PZA', 'CAMINO', 'CMNO', 'RONDA', 'TRAVESIA', 'AUTOVIA', 'AUTOPISTA', 'POLIGONO', 'POL', 'PG', 'URB',
  'URBANIZACION', 'KM', 'SN', 'S', 'N', 'NUM', 'NO', 'DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'A', 'AL',
  'ESTACION', 'SERVICIO', 'SERVICIOS', 'ES', 'E', 'GASOLINERA', 'AREA', 'CARBURANTES', 'SL', 'SA', 'SLU',
  'SOCIEDAD', 'COOPERATIVA', 'INDUSTRIAL', 'PARCELA', 'NAVE', 'LOCAL',
]);

export function words(text) {
  return normalizeBrand(text).split(' ').filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
}

function numbers(text) {
  return new Set((normalizeBrand(text).match(/\b\d+\b/g) ?? []).filter((n) => n !== '0'));
}

// Códigos de carretera («A-5», «CM-403», «N 122», «AP7») normalizados: A5,
// CM403, N122, AP7. Son cortos y words() los descarta, pero identifican la vía.
function roads(text) {
  const t = String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  const out = new Set();
  for (const m of t.matchAll(/\b([A-Z]{1,3})(-|\s?)(\d{1,4})\b/g)) {
    const [, letters, sep, n] = m;
    if (['KM', 'PK', 'NO', 'NUM', 'BJ'].includes(letters)) continue;
    if (sep !== '' && sep !== '-' && !['N', 'A', 'AP', 'AU'].includes(letters)) continue; // «L 16», «S 3»…
    out.add(letters + Number(n));
  }
  return out;
}

/**
 * Cuánto se parecen una estación del mapa oficial y una del Ministerio:
 *  - street: palabras de la calle (o códigos de carretera) en común
 *  - number: comparten número de portal o punto kilométrico
 *  - name:   el nombre oficial comparte alguna palabra con el rótulo o la dirección
 */
export function similarity(e, s) {
  const officialStreet = new Set(words(e.direccion));
  const ministryStreet = words(s.address);
  const officialRoads = roads(e.direccion);
  const street = ministryStreet.filter((w) => officialStreet.has(w)).length
    + [...roads(s.address)].filter((r) => officialRoads.has(r)).length;
  const officialNums = numbers(e.direccion);
  const number = [...numbers(s.address)].some((n) => officialNums.has(n));
  const officialName = new Set(words(e.nombre));
  const name = [...words(s.brand), ...ministryStreet].some((w) => officialName.has(w));
  return { street, number, name };
}

// brandConflict (shared/treboles.js): una «Gasolinera Repsol» nunca es otra cadena.
export { brandConflict };

// Solo se acepta un emparejado si es seguro.
function acceptable(sim, d) {
  if (d <= 30) return 'posición'; // mismas coordenadas
  if (d <= 600 && sim.street >= 1 && sim.number) return 'dirección';
  if (d <= 250 && sim.street >= 1) return 'calle';
  if (d <= 400 && sim.name) return 'nombre';
  return null;
}

/**
 * Empareja cada estación del mapa oficial con la del Ministerio que le
 * corresponde. Solo se acepta si coinciden la calle y el número, la calle (a
 * menos de 250 m), el nombre (a menos de 400 m) o la posición (menos de 30 m).
 * Lo demás queda sin emparejar para revisarlo a mano: nunca se atribuye una
 * estación oficial a la gasolinera de al lado.
 */
export function matchEntries(entries, stations) {
  const index = grid(stations);
  const matched = [];
  const unmatched = [];
  const used = new Map();
  for (const e of entries) {
    let best = null;
    for (const s of nearbyCandidates(index, e.lat, e.lon)) {
      const d = haversineKm(e.lat, e.lon, s.lat, s.lon) * 1000;
      if (d > 600) continue;
      if (brandConflict(e.tipo, s.brand)) continue; // otra cadena: nunca es esta
      const sim = similarity(e, s);
      const how = acceptable(sim, d);
      if (!how) continue;
      // Más peso a la dirección que a la distancia.
      const score = (sim.number ? 1000 : 0) + sim.street * 200 + (sim.name ? 150 : 0) - d;
      if (!best || score > best.score) best = { s, d, score, how };
    }
    if (!best) {
      unmatched.push(e);
      continue;
    }
    const prev = used.get(best.s.id);
    if (prev && prev.score >= best.score) {
      unmatched.push(e); // otra estación oficial encaja mejor con esa gasolinera
      continue;
    }
    const m = {
      id: best.s.id,
      tipo: e.tipo,
      nombre: e.nombre,
      direccionOficial: e.direccion,
      ventajas: e.ventajas || '',
      distanceM: Math.round(best.d),
      por: best.how,
      score: best.score,
      brand: best.s.brand,
      address: best.s.address,
      locality: best.s.locality,
      province: best.s.province,
      idProvincia: best.s.idProvincia,
    };
    if (prev) {
      matched.splice(matched.indexOf(prev), 1);
      unmatched.push(prev.entry);
    }
    used.set(best.s.id, { ...m, entry: e });
    matched.push(used.get(best.s.id));
  }
  return { matched: matched.map(({ entry, score, ...m }) => m), unmatched };
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

const REPSOL_FAMILY = /\b(REPSOL|CAMPSA|PETRONOR)\b/i;
// Palabras del nombre oficial que no dicen nada de la calle.
const NOISE = new Set(['CRED', 'AVDA', 'AVENIDA', 'CALLE', 'CTRA', 'CARRETERA', 'GASOLINERA', 'ESTACION', 'SERVICIO']);

/**
 * Revisa la lista de adheridas con las estaciones actuales del Ministerio:
 * las «Gasolinera Repsol» que hoy tienen el rótulo de otra cadena (cambió de
 * bandera o se emparejó con la de al lado) se pasan a la Repsol cercana de la
 * misma calle si la hay (≤ 1,5 km) y, si no, se quitan.
 * Devuelve { list, removed, moved } sin tocar la lista original.
 */
export function reviewOfficial(list, stations) {
  const byId = new Map(stations.map((s) => [String(s.id), s]));
  const next = { ...list.stations };
  const removed = [];
  const moved = [];
  for (const [id, v] of Object.entries(list.stations ?? {})) {
    const wrong = byId.get(id);
    if (!wrong || !brandConflict(v.tipo, wrong.brand)) continue;
    delete next[id];
    const nameWords = new Set(words(v.nombre).filter((w) => !NOISE.has(w)));
    let best = null;
    for (const s of stations) {
      if (!REPSOL_FAMILY.test(s.brand ?? '') || next[s.id] || list.stations[s.id]) continue;
      const d = haversineKm(wrong.lat, wrong.lon, s.lat, s.lon);
      if (d > 1.5) continue;
      if (!words(s.address).some((w) => nameWords.has(w))) continue;
      if (!best || d < best.d) best = { s, d };
    }
    if (best) {
      next[String(best.s.id)] = v;
      moved.push({ nombre: v.nombre, from: `${wrong.brand} · ${wrong.address}`, to: `${best.s.brand} · ${best.s.address}`, km: best.d });
    } else {
      removed.push({ nombre: v.nombre, wrong: `${wrong.brand} · ${wrong.address} · ${wrong.locality ?? ''}` });
    }
  }
  return { list: { ...list, stations: next }, removed, moved };
}

/**
 * La lista que sirve el servidor, revisada sola con cada descarga del
 * Ministerio (cada 30 min). Se recalcula solo si cambia la lista o los datos.
 * Añade `revision`: { fecha, corregidas, quitadas, ejemplos } para Ajustes.
 */
export function createReviewedSource(source, store) {
  let cache = { base: null, fetchedAt: null, data: null };
  return {
    async get() {
      const base = await source.get();
      const stations = store?.stations ?? [];
      if (!store?.ready || !stations.length) return base; // aún sin precios: tal cual
      if (cache.base === base && cache.fetchedAt === store.fetchedAt) return cache.data;
      const { list, removed, moved } = reviewOfficial(base, stations);
      const data = {
        ...list,
        revision: {
          fecha: store.fecha,
          corregidas: moved.length,
          quitadas: removed.length,
          ejemplos: [...moved.map((m) => `${m.nombre}: ahora ${m.to}`), ...removed.map((r) => `${r.nombre}: hoy es ${r.wrong}`)].slice(0, 20),
        },
      };
      cache = { base, fetchedAt: store.fetchedAt, data };
      return data;
    },
  };
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
