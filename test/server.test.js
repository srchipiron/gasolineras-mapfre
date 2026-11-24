import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { createHttpServer } from '../server/app.js';
import { StationStore } from '../server/store.js';
import { createDemoGeocoder, createDemoRouter, createDemoHistory } from '../server/demo.js';
import { parseLocatorPayload } from '../shared/locator.js';
import { TrendStore } from '../server/tendencia.js';
import { madridDate } from '../server/store.js';

const raw = JSON.parse(readFileSync(new URL('./fixtures/minetur-sample.json', import.meta.url)));
const quiet = { info() {}, warn() {}, error() {} };
let server, base, port, trend;

before(async () => {
  const store = new StationStore({ load: async () => raw, refreshMs: 0, logger: quiet });
  await store.init();
  trend = new TrendStore({ loadDay: async () => raw, delayMs: 0, logger: quiet });
  trend.days.set(madridDate(new Date(), -7), { 28: { gasoleoA: 1.5 }, ES: { gasoleoA: 1.52 } });
  server = createHttpServer({
    store,
    geocoder: createDemoGeocoder(),
    router: createDemoRouter(),
    history: createDemoHistory(),
    trend,
    official: { get: async () => ({ version: 1, updatedAt: '2026-11-18', source: 'test', provinces: ['28'], stations: { 1001: { tipo: 'colaboradora', nombre: 'GALP' } } }) },
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
  assert.equal(body.trendDays, 1, 'días de tendencia descargados');
  assert.match(body.version, /^\d+\.\d+\.\d+$/, 'versión publicada');
});

test('estaciones cercanas', async () => {
  const { body } = await getJson('/api/stations?lat=40.4168&lon=-3.7038&radius=50&fuel=gasoleoA&public=1');
  assert.deepEqual(body.stations.map((s) => s.id).sort(), ['1001', '1002', '1003']);
  assert.ok(body.stations.every((s) => typeof s.distanceKm === 'number'));
});

test('tendencia de la provincia: hace una semana frente a hoy', async () => {
  const { status, body } = await getJson('/api/trend?province=28&fuel=gasoleoA');
  assert.equal(status, 200);
  assert.equal(body.provinceName, 'Madrid');
  assert.equal(body.series.length, 15);
  assert.equal(body.days, 2);
  assert.equal(body.summary.days, 7);
  assert.equal(body.summary.ref, 1.5);
  assert.ok(body.summary.last > 0 && body.summary.last !== 1.5);
  assert.equal((await getJson('/api/trend?province=x1&fuel=gasoleoA')).status, 400);
  assert.equal((await getJson('/api/trend?province=28&fuel=../x')).status, 400);
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
  // Sin el origen, OpenStreetMap sirve teselas de «Access blocked».
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(await res.text(), /Repostar con Tréboles/);
  assert.equal((await fetch(`${base}/shared/treboles.js`)).status, 200);
  assert.equal((await fetch(`${base}/no-existe.js`)).status, 404);
});

test('respuestas comprimidas con gzip', async () => {
  const res = await fetch(`${base}/js/app.js`, { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(res.headers.get('content-encoding'), 'gzip');
  assert.match(await res.text(), /import/); // fetch descomprime
});

test('ETag: lo que no ha cambiado se responde con un 304 vacío', async () => {
  for (const path of ['/js/app.js', '/index.html', '/data/adheridas.json']) {
    const a = await fetch(base + path);
    const etag = a.headers.get('etag');
    await a.arrayBuffer();
    assert.ok(etag, path + ' sin ETag');
    const b = await fetch(base + path, { headers: { 'If-None-Match': etag } });
    assert.equal(b.status, 304, path);
    assert.equal((await b.arrayBuffer()).byteLength, 0);
    const c = await fetch(base + path, { headers: { 'If-None-Match': '"otro"' } });
    assert.equal(c.status, 200);
    await c.arrayBuffer();
  }
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

test('lista compartida de adheridas', async () => {
  const { status, body } = await getJson('/api/adheridas');
  assert.equal(status, 200);
  assert.deepEqual(body.provinces, ['28']);
  assert.equal(body.stations['1001'].tipo, 'colaboradora');
  // La misma lista como fichero de la app, para que la precargue el service worker
  const local = await getJson('/data/adheridas.json');
  assert.equal(local.status, 200);
  assert.deepEqual(local.body, body);
});

test('emparejado de estaciones del localizador', async () => {
  const locator = JSON.parse(readFileSync(new URL('./fixtures/localizador-sample.json', import.meta.url)));
  const post = (body, headers = {}) => fetch(`${base}/api/adheridas/match`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
  });
  const res = await post(JSON.stringify({ entries: parseLocatorPayload(locator) }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.received, 3);
  assert.deepEqual(body.matched.map((m) => m.id), ['1001', '1003']);
  assert.equal(body.unmatched.length, 1);
  assert.deepEqual(body.provinces, [{ idProvincia: '28', province: 'Madrid', count: 2, total: 4 }]);
  assert.equal((await post('no es json')).status, 400);
  assert.equal((await post(JSON.stringify({}))).status, 400);
  assert.equal((await post(JSON.stringify({ entries: [] }), { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  const plain = await fetch(`${base}/api/adheridas/match`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(plain.status, 415);
  const big = await post(JSON.stringify({ entries: [], pad: 'x'.repeat(5 * 1024 * 1024) }));
  assert.equal(big.status, 413);
});

test('«Enviar a Tréboles»: el mapa oficial sube su lista y la app la recoge una sola vez', async () => {
  const locator = readFileSync(new URL('./fixtures/localizador-sample.json', import.meta.url), 'utf8');
  // Conexión propia en cada petición (la prueba anterior deja una conexión a medias).
  const up = (origin, body = locator) => new Promise((resolve, reject) => {
    const req = request(`${base}/api/adheridas/captura`, {
      method: 'POST', agent: false,
      headers: { Origin: origin, 'Content-Type': 'text/plain;charset=UTF-8', 'Sec-Fetch-Site': 'cross-site' },
    }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, json: () => JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body);
  });
  const res = await up('https://www.mapfretecuidamos.com');
  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'https://www.mapfretecuidamos.com');
  const { id, count } = res.json();
  assert.equal(count, 3);
  assert.match(id, /^[\w-]{16}$/);
  // Desde otra web, no.
  assert.equal((await up('https://otra-web.example')).status, 403);
  assert.equal((await up('https://www.mapfretecuidamos.com', '{"nada":1}')).status, 400);
  // La app la recoge con el código, una sola vez.
  const get = (path) => new Promise((resolve, reject) => {
    request(`${base}${path}`, { agent: false }, (r) => {
      let text = '';
      r.on('data', (c) => { text += c; });
      r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(text) }));
    }).on('error', reject).end();
  });
  const first = await get(`/api/adheridas/captura/${id}`);
  assert.equal(first.status, 200);
  assert.equal(first.body.entries.length, 3);
  assert.equal((await get(`/api/adheridas/captura/${id}`)).status, 404);
});

test('precios de ayer: se descargan una vez y se añaden a las estaciones', async () => {
  const { StationStore: Store, madridDate } = await import('../server/store.js');
  assert.match(madridDate(new Date(Date.UTC(2026, 10, 17, 23, 30))), /^2026-11-18$/, 'a las 00:30 en Madrid ya es el día 18');
  let calls = 0;
  const yesterday = structuredClone(raw);
  yesterday.ListaEESSPrecio[0]['Precio Gasoleo A'] = '1,509';
  const store = new Store({ load: async () => raw, loadPrev: async () => { calls++; return yesterday; }, refreshMs: 0, logger: quiet });
  await store.init();
  await store.ensurePrev();
  await store.ensurePrev();
  assert.equal(calls, 1);
  assert.equal(store.prevFor('1001').gasoleoA, 1.509);
  assert.equal(store.status().prevDate, madridDate(new Date(), -1));
  const s = createHttpServer({ store, geocoder: createDemoGeocoder(), router: createDemoRouter(), history: createDemoHistory(), logger: quiet });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const res = await fetch(`http://127.0.0.1:${s.address().port}/api/stations?lat=40.4168&lon=-3.7038&radius=50`);
  const body = await res.json();
  assert.equal(body.stations.find((x) => x.id === '1001').prev.gasoleoA, 1.509);
  assert.equal(body.prevDate, store.prev.date);
  s.close();
});

test('si falla la descarga de ayer, la app sigue funcionando', async () => {
  const { StationStore: Store } = await import('../server/store.js');
  const store = new Store({ load: async () => raw, loadPrev: async () => { throw new Error('sin red'); }, refreshMs: 0, logger: quiet });
  await store.init();
  await store.ensurePrev();
  assert.equal(store.prevFor('1001'), null);
  assert.equal(store.ready, true);
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
