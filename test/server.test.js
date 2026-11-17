import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { createHttpServer } from '../server/app.js';
import { StationStore } from '../server/store.js';
import { createDemoGeocoder, createDemoRouter, createDemoHistory } from '../server/demo.js';

const raw = JSON.parse(readFileSync(new URL('./fixtures/minetur-sample.json', import.meta.url)));
const quiet = { info() {}, warn() {}, error() {} };
let server, base, port;

before(async () => {
  const store = new StationStore({ load: async () => raw, refreshMs: 0, logger: quiet });
  await store.init();
  server = createHttpServer({
    store,
    geocoder: createDemoGeocoder(),
    router: createDemoRouter(),
    history: createDemoHistory(),
    logger: quiet,
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});

after(() => server.close());

const getJson = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};

test('estado', async () => {
  const { status, body } = await getJson('/api/status');
  assert.equal(status, 200);
  assert.equal(body.count, 4);
  assert.equal(body.ready, true);
});

test('estaciones cercanas', async () => {
  const { body } = await getJson('/api/stations?lat=40.4168&lon=-3.7038&radius=50&fuel=gasoleoA&public=1');
  assert.deepEqual(body.stations.map((s) => s.id).sort(), ['1001', '1002', '1003']);
  assert.ok(body.stations.every((s) => typeof s.distanceKm === 'number'));
});

test('validación de parámetros', async () => {
  assert.equal((await getJson('/api/stations?lat=abc&lon=1')).status, 400);
  assert.equal((await getJson('/api/stations?lat=40&lon=-3&radius=1000')).status, 400);
  assert.equal((await getJson('/api/stations?lat=40&lon=-3&fuel=../x')).status, 400);
  assert.equal((await getJson('/api/route?from=1&to=2')).status, 400);
  assert.equal((await getJson('/api/geocode?q=a')).status, 400);
  assert.equal((await getJson('/api/nada')).status, 404);
});

test('estación por id, varias por id e histórico', async () => {
  assert.equal((await getJson('/api/stations/1001')).body.station.brand, 'GALP');
  assert.equal((await getJson('/api/stations/9999')).status, 404);
  assert.deepEqual((await getJson('/api/stations/byIds?ids=1002,1001,nope')).body.stations.map((s) => s.id), ['1002', '1001']);
  const h = await getJson('/api/history/1001?days=7');
  assert.equal(h.body.series.length, 8);
});

test('ruta con gasolineras en el corredor', async () => {
  const { body } = await getJson('/api/route?from=40.40,-3.72&to=40.48,-3.70&corridor=1.5');
  assert.ok(body.route.distanceKm > 5);
  assert.deepEqual(body.stations.map((s) => s.id), ['1001', '1002', '1003']);
});

test('ficheros estáticos y cabeceras de seguridad', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await res.text(), /Repostar con Tréboles/);
  assert.equal((await fetch(`${base}/shared/treboles.js`)).status, 200);
  assert.equal((await fetch(`${base}/no-existe.js`)).status, 404);
});

test('respuestas comprimidas con gzip', async () => {
  const res = await fetch(`${base}/js/app.js`, { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(res.headers.get('content-encoding'), 'gzip');
  assert.match(await res.text(), /import/); // fetch descomprime
});

test('no se puede salir de la carpeta pública', async () => {
  for (const path of ['/../package.json', '/%2e%2e/package.json', '/shared/../server/app.js', '/%2e%2e%2fserver%2fapp.js']) {
    const status = await new Promise((resolve, reject) => {
      // http.request no normaliza la ruta, a diferencia de fetch.
      const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
    assert.ok([403, 404].includes(status), `${path} -> ${status}`);
  }
});

test('503 mientras no hay datos', async () => {
  const store = new StationStore({ load: async () => { throw new Error('sin red'); }, refreshMs: 0, logger: quiet });
  await store.init();
  const s = createHttpServer({ store, geocoder: createDemoGeocoder(), router: createDemoRouter(), history: createDemoHistory(), logger: quiet });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const res = await fetch(`http://127.0.0.1:${s.address().port}/api/stations?lat=40&lon=-3`);
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /sin red/);
  s.close();
});
