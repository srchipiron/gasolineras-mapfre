import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { boostReminderIcs } from '../shared/ics.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const pathFor = (u) => {
  if (u === '/data/adheridas.json') return join(ROOT, 'config', 'adheridas.json'); // lo sirve el servidor
  return u.startsWith('/shared/') ? join(ROOT, u) : join(ROOT, 'public', u === '/' ? 'index.html' : u);
};

test('todos los ficheros que precarga el service worker existen', () => {
  const sw = readFileSync(join(ROOT, 'public/sw.js'), 'utf8');
  const list = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  assert.ok(list.length > 10);
  for (const u of list) assert.ok(existsSync(pathFor(u)), `falta ${u}`);
  // Todos los módulos JS de la app están precargados (para funcionar sin conexión)
  for (const f of ['shared/ics.js', 'shared/locator.js', 'shared/provincias.js']) assert.ok(list.includes(`/${f}`), f);
});

test('manifiesto: iconos y accesos directos', () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'public/manifest.webmanifest'), 'utf8'));
  for (const i of m.icons) assert.ok(existsSync(join(ROOT, 'public', i.src)), i.src);
  assert.deepEqual(m.shortcuts.map((s) => s.url), ['/?accion=carnet', '/?accion=cerca', '/?accion=repostaje', '/?accion=ruta']);
});

test('recordatorio de calendario', () => {
  const ics = boostReminderIcs({ startISO: '2026-12-01', stamp: new Date(Date.UTC(2026, 10, 18)) });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /DTSTART;VALUE=DATE:20261201\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261206\r\n/);
  assert.match(ics, /RRULE:FREQ=MONTHLY;BYMONTHDAY=1\r\n/);
  assert.match(ics, /DTSTAMP:20261118T000000Z/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  const unfolded = ics.replace(/\r\n /g, '');
  assert.match(unfolded, /Del día 1 al 5 de cada mes/);
});
