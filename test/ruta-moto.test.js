import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTrack, shrinkTrack } from '../shared/track.js';
import { planStops, locateOnRoute, routeProgress } from '../shared/plan.js';
import { cumulativeKm } from '../shared/geo.js';
import { StationStore } from '../server/store.js';
import { createHttpServer } from '../server/app.js';
import { createDemoGeocoder, createDemoRouter, createDemoHistory } from '../server/demo.js';

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wikiloc" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Ruta &amp; curvas</name></metadata>
  <trk><name>Ignorado</name><trkseg>
    <trkpt lat="36.8400" lon="-2.4600"><ele>10</ele></trkpt>
    <trkpt lat="36.8400" lon="-2.4600"><ele>10</ele></trkpt>
    <trkpt lat='36.9000' lon='-2.4000'></trkpt>
    <trkpt lon="-2.3000" lat="37.0000"/>
  </trkseg></trk>
</gpx>`;

test('lee un GPX: nombre, puntos sin repetidos y distancia', () => {
  const t = parseTrack(GPX, 'x.gpx');
  assert.equal(t.name, 'Ruta & curvas');
  assert.equal(t.points.length, 3);
  assert.deepEqual(t.points[2], [37, -2.3]);
  assert.ok(t.distanceKm > 20 && t.distanceKm < 25, String(t.distanceKm));
  assert.equal(t.loop, false);
});

test('lee un KML de Google My Maps (lon,lat,alt) y detecta las circulares', () => {
  const kml = `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Vuelta</name><Placemark><LineString><coordinates>
    -3.70,40.40,0 -3.60,40.45,0
    -3.50,40.40,0 -3.70,40.4001,0
  </coordinates></LineString></Placemark></Document></kml>`;
  const t = parseTrack(kml, 'vuelta.kml');
  assert.equal(t.name, 'Vuelta');
  assert.equal(t.points.length, 4);
  assert.deepEqual(t.points[0], [40.4, -3.7]);
  assert.equal(t.loop, true);
});

test('rechaza ficheros que no son tracks', () => {
  assert.throws(() => parseTrack('hola', 'notas.txt'), /GPX/);
  assert.throws(() => parseTrack('<gpx></gpx>', 'vacio.gpx'), /ningún track/);
});

test('un track enorme se reduce sin pasar del máximo', () => {
  const pts = Array.from({ length: 20000 }, (_, i) => [40 + i * 0.0001, -3 + Math.sin(i / 50) * 0.01]);
  const out = shrinkTrack(pts, 1500);
  assert.ok(out.length <= 1500 && out.length > 50, String(out.length));
  assert.deepEqual(out[0], [40, -3]);
});

// Ruta de 300 km; moto con 15 L y 5 L/100 km: 15·0,85/0,05 = 255 km con reserva.
const st = (id, alongKm, price, extra = {}) => ({ station: { id, brand: id, alongKm, offRouteKm: 0 }, effective: price, price, ...extra });
const opts = { totalKm: 300, tankL: 15, consumption: 5 };

test('sin paradas si llegas con un depósito', () => {
  const p = planStops([st('A', 100, 1.5)], { ...opts, totalKm: 200 });
  assert.equal(p.ok, true);
  assert.equal(p.stops.length, 0);
  assert.equal(p.endLitres, 5);
  assert.equal(p.emptyKm, 255);
});

test('para en la más barata a tu alcance, aunque haya otra más tarde', () => {
  const list = [st('cara', 240, 1.70), st('barata', 150, 1.40), st('media', 60, 1.55)];
  const p = planStops(list, opts);
  assert.equal(p.ok, true);
  assert.deepEqual(p.stops.map((x) => x.r.station.id), ['barata']);
  assert.equal(p.stops[0].arriveL, 7.5);
  assert.equal(p.stops[0].fillL, 7.5);
});

test('nunca baja de la reserva y salta las cerradas', () => {
  // La barata está pasada la autonomía (260 > 255): no vale.
  const list = [st('lejos', 260, 1.20), st('ok', 200, 1.60), st('cerrada', 220, 1.30, { open: false })];
  const p = planStops(list, opts);
  const ids = p.stops.map((x) => x.r.station.id);
  assert.equal(ids[0], 'ok', 'la primera parada es la que está a tu alcance');
  assert.ok(!ids.includes('cerrada'));
  for (const x of p.stops) assert.ok(x.arriveL >= 15 * 0.15 - 1e-9);
});

test('desde un llenado a mitad de ruta y con lo que llevas', () => {
  const list = [st('antes', 50, 1.30), st('despues', 280, 1.50)];
  const p = planStops(list, { ...opts, totalKm: 500, startKm: 100 });
  assert.equal(p.emptyKm, 355);
  assert.deepEqual(p.stops.map((x) => x.r.station.id), ['despues'], 'las de antes del llenado no cuentan');
  // Con 5 L (55 km con reserva) hay que parar en la del km 40.
  const poco = planStops([st('A', 40, 1.5)], { ...opts, totalKm: 280, startLitres: 5 });
  assert.equal(poco.ok, true);
  assert.equal(poco.stops[0].r.station.id, 'A');
});

test('avisa si hay un tramo sin gasolineras a tu alcance', () => {
  const p = planStops([st('A', 150, 1.5)], { ...opts, totalKm: 600 });
  assert.equal(p.ok, false);
  assert.equal(p.reachKm, 405);
});

test('no propone parar a echar cuatro gotas', () => {
  // Llegar a la del km 30 con 13,5 L y echar 1,5 L no es una parada: se espera a la siguiente.
  const p = planStops([st('pronto', 30, 1.2), st('luego', 200, 1.6)], opts);
  assert.deepEqual(p.stops.map((x) => x.r.station.id), ['luego']);
  assert.ok(p.stops.every((x) => x.fillL >= 15 * 0.35));
});

test('POST /api/track devuelve las gasolineras a lo largo del track', async () => {
  const raw = JSON.parse(readFileSync(new URL('./fixtures/minetur-sample.json', import.meta.url)));
  const quiet = { info() {}, warn() {}, error() {} };
  const store = new StationStore({ load: async () => raw, refreshMs: 0, logger: quiet });
  await store.init();
  const s0 = store.stations[0];
  const server = createHttpServer({ store, geocoder: createDemoGeocoder(), router: createDemoRouter(), history: createDemoHistory(), logger: quiet });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/api/track`;
  try {
    const points = [[s0.lat - 0.05, s0.lon], [s0.lat + 0.05, s0.lon]];
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points, corridor: 2 }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.route.distanceKm > 10);
    assert.ok(body.stations.some((x) => x.id === s0.id));
    assert.ok(body.stations.every((x) => x.alongKm != null));
    const bad = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points: [[1, 2]] }) });
    assert.equal(bad.status, 400);
  } finally {
    server.close();
  }
});

test('«Dónde estoy»: sitúa tu posición en la ruta, también en las circulares', () => {
  // Cuadrado de ~44 km que empieza y acaba en el mismo punto.
  const poly = [[37, -2], [37.1, -2], [37.1, -1.875], [37, -1.875], [37, -2]];
  const cum = cumulativeKm(poly);
  const mid = locateOnRoute(37.1, -1.94, poly, cum);
  assert.ok(Math.abs(mid.km - (cum[1] + (cum[2] - cum[1]) / 2)) < 0.5, `km ${mid.km}`);
  assert.ok(mid.offKm < 0.1);
  // En el punto de salida: al empezar es el km 0, y si ya ibas por el final, el último km.
  assert.equal(locateOnRoute(37, -2, poly, cum).km, 0);
  assert.ok(locateOnRoute(37, -2, poly, cum, cum[3] + 2).km > cum[4] - 0.5);
  // Lejos de la ruta.
  assert.ok(locateOnRoute(37.5, -2, poly, cum).offKm > 30);
});

test('«Dónde estoy»: próxima parada y litros que llevas siguiendo el plan', () => {
  const plan = { start: { startKm: 0 }, stops: [{ km: 120, r: { station: { brand: 'A' } } }, { km: 250, r: { station: { brand: 'B' } } }] };
  const o = { tankL: 15, consumption: 5, totalKm: 300 };
  let g = routeProgress(plan, 60, o);
  assert.equal(g.next.km, 120);
  assert.equal(g.toNextKm, 60);
  assert.equal(g.fuelL, 12); // 15 - 60 km a 5 L/100
  assert.equal(g.low, false);
  g = routeProgress(plan, 200, o); // ya llenó en el km 120
  assert.equal(g.passed, 1);
  assert.equal(g.next.km, 250);
  assert.equal(g.fuelL, 11);
  g = routeProgress(plan, 290, o);
  assert.equal(g.next, null);
  assert.equal(g.toEndKm, 10);
  // Sin seguir el plan te quedas en reserva.
  assert.equal(routeProgress({ start: { startKm: 0 }, stops: [] }, 270, o).low, true);
  // Si el plan sale de donde llenaste y aún no has llegado ahí.
  assert.equal(routeProgress({ start: { startKm: 80 }, stops: [] }, 20, o).before, true);
});
