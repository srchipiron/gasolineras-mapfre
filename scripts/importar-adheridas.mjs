#!/usr/bin/env node
// Actualiza config/adheridas.json, la lista compartida de gasolineras adheridas.
//
// Uso:
//   node scripts/importar-adheridas.mjs [opciones] fichero [fichero...]
//
// Cada fichero puede ser:
//   - una respuesta del localizador oficial de Club MAPFRE (JSON)
//   - un HAR exportado desde la pestaña Red del navegador
//   - una lista exportada desde la app (Ajustes → Exportar lista)
//
// Opciones:
//   --provincias 04,11,14   provincias que la lista cubre por completo
//                           (por defecto ninguna, salvo las de una lista exportada)
//   --reemplazar            empieza de cero en vez de añadir a la lista actual
//   --datos ruta.json       caché de estaciones del Ministerio (data/estaciones.json)

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseLocatorPayload } from '../shared/locator.js';
import { matchEntries, provinceSummary, normalizeOfficial } from '../server/adheridas.js';
import { createMineturClient, parseResponse } from '../server/minetur.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'config', 'adheridas.json');

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};
const provinciasArg = opt('--provincias');
const datos = opt('--datos') ?? join(ROOT, 'data', 'estaciones.json');
const reemplazar = flag('--reemplazar');
if (!args.length) {
  console.error('Uso: node scripts/importar-adheridas.mjs [--provincias 04,11] [--reemplazar] fichero...');
  process.exit(1);
}

async function loadStations() {
  if (existsSync(datos)) {
    const d = JSON.parse(await readFile(datos, 'utf8'));
    if (Array.isArray(d.stations)) return d.stations;
  }
  console.log('Descargando estaciones del Ministerio…');
  return parseResponse(await createMineturClient().fetchAll()).stations;
}

const current = reemplazar ? normalizeOfficial({}) : normalizeOfficial(JSON.parse(await readFile(OUT, 'utf8')));
const entries = [];
const exported = [];
for (const f of args) {
  const data = JSON.parse((await readFile(f, 'utf8')).replace(/^﻿/, ''));
  if (data && typeof data.stations === 'object' && !Array.isArray(data.stations) && Array.isArray(data.provinces)) {
    exported.push(normalizeOfficial(data));
  } else {
    entries.push(...parseLocatorPayload(data));
  }
}

const stations = await loadStations();
const { matched, unmatched } = matchEntries(entries, stations);
const next = normalizeOfficial(current);
for (const m of matched) next.stations[m.id] = { tipo: m.tipo, nombre: m.nombre };
const provinces = new Set(next.provinces);
for (const e of exported) {
  Object.assign(next.stations, e.stations);
  e.provinces.forEach((p) => provinces.add(p));
}
// Una provincia solo se da por completa si se indica: con una importación
// parcial dejarían de contar gasolineras que sí están adheridas.
if (provinciasArg) provinciasArg.split(',').map((p) => p.trim().padStart(2, '0')).filter((p) => /^\d{2}$/.test(p)).forEach((p) => provinces.add(p));
next.provinces = [...provinces].sort();
next.updatedAt = new Date().toISOString().slice(0, 10);
next.source = 'Localizador de Club MAPFRE (mapfretecuidamos.com/gasolineras)';
await writeFile(OUT, `${JSON.stringify(next, null, 2)}\n`);

const totals = {};
for (const s of stations) totals[s.idProvincia] = (totals[s.idProvincia] ?? 0) + 1;
console.log(`Leídas ${entries.length} estaciones del localizador; emparejadas ${matched.length}, sin emparejar ${unmatched.length}.`);
for (const p of provinceSummary(matched)) console.log(`  ${p.idProvincia} ${p.province}: ${p.count} de ${totals[p.idProvincia]} gasolineras`);
if (unmatched.length) {
  console.log('Sin emparejar (revísalas a mano):');
  for (const u of unmatched.slice(0, 50)) console.log(`  - ${u.nombre} · ${u.direccion}, ${u.localidad} (${u.lat}, ${u.lon})`);
}
console.log(`Lista guardada en config/adheridas.json: ${Object.keys(next.stations).length} estaciones, provincias ${next.provinces.join(', ') || '—'}.`);
