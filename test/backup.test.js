import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, parseBackup, restoreBackup, backupSummary } from '../shared/backup.js';

const KEYS = { settings: 'gm.settings.v1', favorites: 'gm.favorites.v1', log: 'gm.log.v1', official: 'gm.official.v1', notes: 'gm.notes.v1', card: 'gm.card.v1' };
const keys = Object.values(KEYS);

function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

test('copia y restauración de los datos del dispositivo', () => {
  const src = memoryStorage({
    'gm.settings.v1': JSON.stringify({ fuel: 'gasoleoA', vehicles: [{ id: 'a' }] }),
    'gm.official.v1': JSON.stringify({ stations: { 1: { tipo: 'colaboradora' }, 2: { tipo: 'repsol' } } }),
    'gm.favorites.v1': JSON.stringify([{ id: '1' }]),
    'gm.card.v1': JSON.stringify({ number: '1234' }),
    'gm.lastNearby.v1': JSON.stringify({ big: true }),
    'gm.log.v1': '{estropeado',
  });
  const backup = makeBackup(src, keys, new Date('2026-11-18T20:00:00Z'));
  assert.equal(backup.savedAt, '2026-11-18T20:00:00.000Z');
  assert.deepEqual(Object.keys(backup.data).sort(), ['gm.card.v1', 'gm.favorites.v1', 'gm.official.v1', 'gm.settings.v1'], 'sin la búsqueda guardada ni valores estropeados');
  assert.equal(backupSummary(backup.data, KEYS), 'lista oficial con 2 gasolineras · 1 favoritas · carnet · 1 vehículo');

  const parsed = parseBackup(JSON.stringify(backup), keys);
  const dst = memoryStorage({ 'gm.notes.v1': '{"x":1}' });
  assert.equal(restoreBackup(dst, parsed), 4);
  assert.deepEqual(JSON.parse(dst.getItem('gm.official.v1')).stations['2'], { tipo: 'repsol' });
  assert.equal(dst.getItem('gm.notes.v1'), '{"x":1}', 'lo que no está en la copia se conserva');
});

test('rechaza ficheros que no son copias de esta app', () => {
  assert.throws(() => parseBackup('no json', keys), /no es JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'otra', data: {} }), keys), /no es una copia de esta app/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'gasolineras-mapfre', data: { 'gm.otra': 1 } }), keys), /vacía/);
  const ok = parseBackup(JSON.stringify({ app: 'gasolineras-mapfre', data: { 'gm.card.v1': { number: '9' }, 'gm.malicioso': 'x' } }), keys);
  assert.deepEqual(Object.keys(ok.data), ['gm.card.v1'], 'solo claves conocidas');
});
