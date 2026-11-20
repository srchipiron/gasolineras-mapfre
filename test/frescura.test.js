import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFecha } from '../public/js/format.js';
import { StationStore } from '../server/store.js';
import { createHttpServer } from '../server/app.js';
import { createDemoGeocoder, createDemoRouter, createDemoHistory } from '../server/demo.js';

const raw = JSON.parse(readFileSync(new URL('./fixtures/minetur-sample.json', import.meta.url)));
const quiet = { info() {}, warn() {}, error() {} };

test('la hora del Ministerio se lee bien también antes de las 10 (una sola cifra)', () => {
  const d = parseFecha('20/11/2026 6:39:42');
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()], [2026, 10, 20, 6, 39]);
  assert.equal(parseFecha('19/11/2026 18:33:27').getHours(), 18);
  assert.equal(parseFecha('19/11/2026').getHours(), 0);
  assert.equal(parseFecha(null), null);
});

test('«Actualizar» descarga de nuevo solo si los precios tienen más de 5 minutos', async () => {
  let loads = 0;
  const store = new StationStore({ load: async () => { loads++; return raw; }, refreshMs: 0, logger: quiet });
  await store.init();
  assert.equal(loads, 1);
  const t = Date.parse(store.fetchedAt);
  assert.equal(await store.refreshIfOlder(5 * 60_000, t + 60_000), false, 'recién descargados');
  assert.equal(loads, 1);
  assert.equal(await store.refreshIfOlder(5 * 60_000, t + 6 * 60_000), true);
  assert.equal(loads, 2);
  // Si el Ministerio falla, tampoco se reintenta en cada pulsación.
  const failing = new StationStore({ load: async () => { loads++; throw new Error('caído'); }, refreshMs: 0, logger: quiet });
  const now = Date.now();
  assert.equal(await failing.refreshIfOlder(5 * 60_000, now), true);
  assert.equal(await failing.refreshIfOlder(5 * 60_000, now + 1000), false);
});

test('POST /api/refresh devuelve el estado con la fecha de los precios', async () => {
  const store = new StationStore({ load: async () => raw, refreshMs: 0, logger: quiet });
  await store.init();
  const server = createHttpServer({ store, geocoder: createDemoGeocoder(), router: createDemoRouter(), history: createDemoHistory(), logger: quiet });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/refresh`, { method: 'POST' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.refreshed, false, 'acababa de descargarlos');
    assert.equal(body.fecha, store.fecha);
    assert.ok(body.fetchedAt);
  } finally {
    server.close();
  }
});
