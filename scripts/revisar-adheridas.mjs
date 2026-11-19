// Revisa la lista de adheridas ya importada contra las estaciones del
// Ministerio, sin volver a necesitar los HAR del mapa oficial:
//
//   node scripts/revisar-adheridas.mjs [--datos data/estaciones.json] [--simular]
//
// - Quita las «Gasolinera Repsol» emparejadas con una gasolinera de otra
//   cadena (Plenergy, Petroprix, Ballenoil…): nunca son la misma.
// - Si cerca (≤ 1,5 km) hay una Repsol/Campsa/Petronor que aún no está en la
//   lista y cuya dirección comparte palabras con el nombre oficial, se pasa a
//   ella (p. ej. «CRED AVDA. DEL MEDITERRÁNEO» → la Repsol de Av. Mediterráneo).

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { brandConflict, words } from '../server/adheridas.js';
import { haversineKm } from '../shared/geo.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const OUT = join(ROOT, 'config', 'adheridas.json');
const datos = join(ROOT, opt('--datos', 'data/estaciones.json'));
const simular = args.includes('--simular');

const REPSOL_FAMILY = /\b(REPSOL|CAMPSA|PETRONOR)\b/i;
// Palabras del nombre oficial que no dicen nada de la calle.
const NOISE = new Set(['CRED', 'AVDA', 'AVENIDA', 'CALLE', 'CTRA', 'CARRETERA', 'GASOLINERA', 'ESTACION', 'SERVICIO']);

export function serialize(list) {
  const { stations, ...head } = list;
  const rows = Object.entries(stations).map(([id, v]) => `    ${JSON.stringify(id)}: ${JSON.stringify(v)}`);
  const body = rows.length ? `{\n${rows.join(',\n')}\n  }` : '{}';
  return `${JSON.stringify({ ...head, stations: '@@' }, null, 2).replace('"@@"', body)}\n`;
}

/** Revisa `list.stations` y devuelve { list, removed, moved }. */
export function review(list, stations) {
  const byId = new Map(stations.map((s) => [String(s.id), s]));
  const next = { ...list.stations };
  const removed = [];
  const moved = [];
  for (const [id, v] of Object.entries(list.stations)) {
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const list = JSON.parse(await readFile(OUT, 'utf8'));
  const { stations } = JSON.parse(await readFile(datos, 'utf8'));
  const res = review(list, stations);
  for (const m of res.moved) console.log(`→ ${m.nombre}: ${m.from}  ⇒  ${m.to} (${m.km.toFixed(2)} km)`);
  for (const r of res.removed) console.log(`✗ ${r.nombre}: era ${r.wrong}`);
  console.log(`\n${res.moved.length} corregidas, ${res.removed.length} quitadas. Quedan ${Object.keys(res.list.stations).length} adheridas.`);
  if (!simular) await writeFile(OUT, serialize(res.list));
}
