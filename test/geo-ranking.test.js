import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { haversineKm, distanceToPolyline, simplifyPolyline, cumulativeKm, isHere, shouldRelocate } from '../shared/geo.js';
import { enrich, filterResults, sortResults, summarize, priceLevel, compareFilter, byBrand } from '../shared/ranking.js';
import { cloneProgram } from '../shared/treboles.js';
import { parseResponse } from '../server/minetur.js';
import { nearby, alongRoute } from '../server/search.js';

const { stations } = parseResponse(JSON.parse(readFileSync(new URL('./fixtures/minetur-sample.json', import.meta.url))));
const MADRID = { lat: 40.4168, lon: -3.7038 };

test('haversine: Madrid–Barcelona ≈ 505 km', () => {
  const d = haversineKm(40.4168, -3.7038, 41.3874, 2.1686);
  assert.ok(d > 500 && d < 510, String(d));
});

test('distancia a una ruta y km recorridos', () => {
  const line = [[40, -3], [40, -2]]; // ~85 km hacia el este
  const r = distanceToPolyline(40.009, -2.5, line);
  assert.ok(Math.abs(r.distanceKm - 1) < 0.05, String(r.distanceKm));
  assert.ok(Math.abs(r.alongKm - cumulativeKm(line)[1] / 2) < 0.5);
});

test('simplificación de polilíneas conserva extremos', () => {
  const line = Array.from({ length: 101 }, (_, i) => [40 + i * 0.001, -3 + (i % 2) * 0.00001]);
  const s = simplifyPolyline(line, 0.05);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0], line[0]);
  assert.deepEqual(s[1], line[100]);
});

test('búsqueda cercana: radio, carburante y venta restringida', () => {
  const all = nearby(stations, { ...MADRID, radiusKm: 50 });
  assert.deepEqual(all.map((s) => s.id).sort(), ['1001', '1002', '1003', '1004']);
  assert.ok(all[0].distanceKm <= all[1].distanceKm);
  assert.equal(nearby(stations, { ...MADRID, radiusKm: 50, publicOnly: true }).length, 3);
  assert.deepEqual(nearby(stations, { ...MADRID, radiusKm: 50, fuel: 'glp' }).map((s) => s.id), ['1002']);
  assert.equal(nearby(stations, { ...MADRID, radiusKm: 1 }).length, 0);
});

test('búsqueda en ruta: solo las que quedan cerca del trazado', () => {
  const route = [[40.40, -3.72], [40.48, -3.70]]; // de sur a norte por el centro de Madrid
  const res = alongRoute(stations, route, { corridorKm: 1.5 });
  assert.deepEqual(res.map((s) => s.id), ['1001', '1002', '1003']);
  assert.ok(res[0].alongKm < res[2].alongKm);
  assert.ok(res.every((s) => s.offRouteKm <= 1.5));
});

test('ranking: el precio con tréboles puede cambiar el orden', () => {
  const near = nearby(stations, { ...MADRID, radiusKm: 50, publicOnly: true });
  const program = cloneProgram();
  // Lista oficial de Madrid con la Galp 1001 como colaboradora.
  const official = { provinces: ['28'], stations: { 1001: { tipo: 'colaboradora', nombre: 'E.S. GALP' } } };
  const opts = { fuel: 'gasoleoA', program, official, litres: 40, consumption: 6, now: new Date(2026, 11, 2) }; // día 2: 6 %
  const list = enrich(near, opts);
  const galp = list.find((r) => r.station.id === '1001');
  assert.equal(galp.mapfre, true);
  assert.equal(galp.approx, false);
  assert.equal(galp.percent, 6);
  assert.equal(galp.effective.toFixed(4), (1.489 * 0.94).toFixed(4));
  assert.equal(galp.treboles, Math.round(1.489 * 40 * 6) / 100);
  // La Repsol de Madrid no está en la lista oficial de Madrid: no cuenta
  assert.equal(list.find((r) => r.station.id === '1003').mapfre, false);
  // Con 6 %: Galp 1,3997 € frente a Plenoil 1,429 € -> Galp primero
  assert.equal(sortResults(list, 'effective')[0].station.id, '1001');
  // El día 20 (3 %): Galp 1,4443 € -> Plenoil primero
  assert.equal(sortResults(enrich(near, { ...opts, now: new Date(2026, 11, 20) }), 'effective')[0].station.id, '1002');
  // Por precio de surtidor siempre gana Plenoil
  assert.equal(sortResults(list, 'price')[0].station.id, '1002');
});

test('sin lista oficial ninguna gasolinera da tréboles (no se deduce por la marca)', () => {
  const near = nearby(stations, { ...MADRID, radiusKm: 50, publicOnly: true });
  const list = enrich(near, { fuel: 'gasoleoA', program: cloneProgram(), now: new Date(2026, 11, 2) });
  assert.ok(list.every((r) => !r.mapfre && !r.adherida));
  assert.deepEqual(filterResults(list, { onlyMapfre: true }), []);
});

test('con la lista oficial: carnet 6 %/3 % y, si el mapa indica un porcentaje, ese', () => {
  const near = nearby(stations, { ...MADRID, radiusKm: 50, publicOnly: true });
  const official = { provinces: [], stations: { 1001: { tipo: 'colaboradora', nombre: 'GALP' }, 1003: { tipo: 'colaboradora', nombre: 'REPSOL', ventajas: '6% en Tréboles con la Tarjeta Repsol Carburante' } } };
  const list = enrich(near, { fuel: 'gasoleoA', program: cloneProgram(), official, now: new Date(2026, 11, 2) });
  const galp = list.find((r) => r.station.id === '1001');
  const repsol = list.find((r) => r.station.id === '1003');
  assert.equal(galp.mapfre, true);
  assert.equal(galp.percent, 6, 'día 2: 6 % con el carnet');
  assert.equal(repsol.percent, 0, 'sin la Tarjeta Repsol Carburante, el carnet no da nada');
  assert.equal(repsol.mapfre, false);
  assert.equal(repsol.adherida, true);
  assert.equal(repsol.rule.needsCard, true);
  const conTarjeta = { ...cloneProgram(), repsolCard: true };
  const lc = enrich(near, { fuel: 'gasoleoA', program: conTarjeta, official, now: new Date(2026, 11, 2) });
  assert.equal(lc.find((r) => r.station.id === '1003').percent, 6, 'con la tarjeta: porcentaje del texto de ventajas');
  assert.equal(repsol.rule.ventajas, '6% en Tréboles con la Tarjeta Repsol Carburante');
  assert.equal(list.find((r) => r.station.id === '1002').mapfre, false);
  // Filtro por tipo, como el desplegable del mapa oficial
  const mixto = { provinces: [], stations: { 1001: { tipo: 'colaboradora' }, 1003: { tipo: 'repsol' } } };
  const r2 = enrich(near, { fuel: 'gasoleoA', program: cloneProgram(), official: mixto, overrides: { 1002: 'in' }, now: new Date(2026, 11, 2) });
  const ids = (tipo) => filterResults(r2, { onlyMapfre: true, tipo }).map((r) => r.station.id).sort();
  assert.deepEqual(ids('all'), ['1001', '1002', '1003']);
  assert.deepEqual(ids('colaboradora'), ['1001', '1002'], 'la marcada a mano se ve siempre');
  assert.deepEqual(ids('repsol'), ['1002', '1003']);
  const later = enrich(near, { fuel: 'gasoleoA', program: conTarjeta, official, now: new Date(2026, 11, 20) });
  assert.equal(later.find((r) => r.station.id === '1001').percent, 3);
  assert.equal(later.find((r) => r.station.id === '1003').percent, 6, 'el porcentaje del mapa no depende del día');
});

test('GLP: la estación está adherida pero no da tréboles', () => {
  const near = nearby(stations, { ...MADRID, radiusKm: 50, fuel: 'glp' });
  const official = { provinces: [], stations: { 1002: { tipo: 'colaboradora' } } };
  const [r] = enrich(near, { fuel: 'glp', program: cloneProgram(), official, now: new Date(2026, 11, 2) });
  assert.equal(r.adherida, true);
  assert.equal(r.mapfre, false);
  assert.equal(r.percent, 0);
  assert.equal(r.effective, r.price);
});

test('tope de 100 € al día en el precio efectivo', () => {
  const near = nearby(stations, { ...MADRID, radiusKm: 50, publicOnly: true });
  const official = { provinces: [], stations: { 1001: { tipo: 'colaboradora', nombre: 'GALP' }, 1003: { tipo: 'colaboradora', nombre: 'REPSOL', ventajas: '6% en Tréboles con la Tarjeta Repsol Carburante' } } };
  const [galp] = enrich(near.filter((s) => s.id === '1001'), { fuel: 'gasoleoA', program: cloneProgram(), official, litres: 80, now: new Date(2026, 11, 2) });
  assert.equal(galp.treboles, 6); // 6 % de 100 €
  assert.equal(galp.effective.toFixed(5), (1.489 * (1 - 0.06 * (100 / (1.489 * 80)))).toFixed(5));
});

test('el tope restante de hoy reduce los tréboles', () => {
  const near = nearby(stations, { ...MADRID, radiusKm: 50, publicOnly: true }).filter((s) => s.id === '1001');
  const opts = { fuel: 'gasoleoA', program: cloneProgram(), official: { provinces: [], stations: { 1001: { tipo: 'colaboradora', nombre: 'GALP' }, 1003: { tipo: 'colaboradora', nombre: 'REPSOL', ventajas: '6% en Tréboles con la Tarjeta Repsol Carburante' } } }, litres: 40, now: new Date(2026, 11, 2) };
  const [full] = enrich(near, opts);
  const [half] = enrich(near, { ...opts, capLeft: 30 });
  const [none] = enrich(near, { ...opts, capLeft: 0 });
  assert.equal(full.treboles, Math.round(1.489 * 40 * 6) / 100);
  assert.equal(half.treboles, 1.8);
  assert.ok(half.cappedBy > 0);
  assert.equal(none.treboles, 0);
  assert.equal(none.effective, none.price);
  assert.ok(full.effective < half.effective && half.effective < none.effective);
});

test('variación frente a ayer', () => {
  const st = (id, price, prev) => ({ id, brand: 'X', prices: { gasoleoA: price }, prev: prev == null ? undefined : { gasoleoA: prev }, schedule: '' });
  const list = enrich([st('a', 1.5, 1.52), st('b', 1.6, 1.59), st('c', 1.55, 1.55), st('d', 1.7)], { fuel: 'gasoleoA', program: cloneProgram() });
  assert.deepEqual(list.map((r) => r.change), [-0.02, 0.01, 0, null]);
  const s = summarize(list);
  assert.equal(s.avgChange.toFixed(4), (-0.01 / 3).toFixed(4));
  assert.equal(s.changedDown, 1);
  assert.equal(s.changedUp, 1);
  assert.equal(summarize(enrich([st('d', 1.7)], { fuel: 'gasoleoA', program: cloneProgram() })).avgChange, null);
});

test('resumen y filtros', () => {
  const near = nearby(stations, { ...MADRID, radiusKm: 50 });
  const list = enrich(near, { fuel: 'gasoleoA', program: { ...cloneProgram(), repsolCard: true }, official: { provinces: [], stations: { 1001: { tipo: 'colaboradora', nombre: 'GALP' }, 1003: { tipo: 'colaboradora', nombre: 'REPSOL', ventajas: '6% en Tréboles con la Tarjeta Repsol Carburante' } } }, now: new Date(2026, 11, 20, 12) });
  assert.equal(filterResults(list, { hideRestricted: true }).length, 3);
  assert.equal(filterResults(list, { hideRestricted: false }).length, 4);
  assert.equal(filterResults(list, { onlyMapfre: true }).length, 2);
  const s = summarize(filterResults(list));
  assert.equal(s.count, 3);
  assert.equal(s.mapfreCount, 2);
  assert.equal(s.min, 1.429);
  assert.equal(s.max, 1.519);
  // Día 20: Galp 3 % = 1,4443 €; Repsol 6 % (ventajas) = 1,4279 €
  assert.equal(s.bestMapfre.station.id, '1003');
  assert.equal(s.bestNonMapfre.station.id, '1002');
  assert.equal(s.cheapestPump.station.id, '1002', 'la más barata en surtidor, sea o no adherida');
  assert.equal(priceLevel(1.429, s), 'cheap');
  assert.equal(priceLevel(1.519, s), 'expensive');
  assert.deepEqual(summarize([]), { count: 0 });
});

test('coste real incluye el desvío de ida y vuelta', () => {
  const st = { id: 'x', brand: 'X', prices: { gasoleoA: 1.5 }, distanceKm: 10, schedule: '' };
  const [r] = enrich([st], { fuel: 'gasoleoA', program: cloneProgram(), litres: 40, consumption: 5 });
  // 10 km * 2 * 1,3 = 26 km -> 1,3 L -> 1,95 €
  assert.equal(r.detourKm.toFixed(1), '26.0');
  assert.equal(r.detourCost.toFixed(2), '1.95');
  assert.equal(r.totalCost.toFixed(2), (40 * 1.5 + 1.95).toFixed(2));
});

test('¿merecen la pena los tréboles? mejor del filtro frente a mejor de fuera, por coste real', () => {
  const near = nearby(stations, { ...MADRID, radiusKm: 50, publicOnly: true });
  const official = { provinces: [], stations: { 1001: { tipo: 'colaboradora' }, 1003: { tipo: 'repsol' } } };
  const list = enrich(near, { fuel: 'gasoleoA', program: cloneProgram(), official, litres: 40, consumption: 6, now: new Date(2026, 11, 2) });
  // Filtro «Más EESS colaboradoras»: dentro la Galp 1001; fuera la Plenoil 1002 y la Repsol 1003
  const c = compareFilter(list, { tipo: 'colaboradora' });
  assert.equal(c.bestIn.station.id, '1001');
  assert.equal(c.insideCount, 1);
  assert.equal(c.outsideCount, 2);
  assert.equal(c.bestOut.station.id, [list.find((r) => r.station.id === '1002'), list.find((r) => r.station.id === '1003')]
    .sort((a, b) => a.totalCost - b.totalCost)[0].station.id);
  assert.equal(c.saving.toFixed(4), (c.bestOut.totalCost - c.bestIn.totalCost).toFixed(4));
  // El día 2 (6 %) la Galp con tréboles sale mejor que la Plenoil más cercana
  assert.ok(c.saving > 0);
  // Día 20 (3 %): la Galp ya no compensa
  const later = enrich(near, { fuel: 'gasoleoA', program: cloneProgram(), official, litres: 40, consumption: 6, now: new Date(2026, 11, 20) });
  assert.ok(compareFilter(later, { tipo: 'colaboradora' }).saving < 0);
  // Con «Todas», dentro están las dos adheridas
  assert.equal(compareFilter(list, { tipo: 'all' }).insideCount, 2);
  // Sin adheridas no hay mejor del filtro
  const none = enrich(near, { fuel: 'gasoleoA', program: cloneProgram(), now: new Date(2026, 11, 2) });
  assert.equal(compareFilter(none, { tipo: 'all' }).bestIn, null);
});

test('la más barata de cada marca', () => {
  const near = nearby(stations, { ...MADRID, radiusKm: 50 });
  const list = enrich([...near, { ...near[0], id: 'x', brand: 'galp ', prices: { gasoleoA: 1.6 }, distanceKm: 9 }], {
    fuel: 'gasoleoA', program: cloneProgram(), official: { provinces: [], stations: { 1001: { tipo: 'colaboradora', nombre: 'GALP' } } }, now: new Date(2026, 11, 20, 12),
  });
  const groups = byBrand(list);
  const galp = groups.find((g) => g.brand === 'GALP');
  assert.equal(galp.count, 2, 'misma marca aunque cambien mayúsculas o espacios');
  assert.equal(galp.mapfreCount, 1);
  assert.equal(galp.best.station.id, '1001');
  for (let i = 1; i < groups.length; i++) assert.ok(groups[i - 1].best.effective <= groups[i].best.effective, 'ordenadas de más barata a más cara');
  assert.deepEqual(byBrand([]), []);
});

test('al abrir: vuelve a buscar cerca de ti solo si te has movido', () => {
  const almeria = { lat: 36.84, lon: -2.46, label: 'Tu ubicación', gps: true };
  // Sin moverse (unos 300 m): se queda donde estaba.
  assert.equal(shouldRelocate(almeria, { lat: 36.8427, lon: -2.46 }), false);
  // A 20 km (Níjar): vuelve a buscar.
  assert.equal(shouldRelocate(almeria, { lat: 36.96, lon: -2.21 }), true);
  // Guardado por una versión anterior, sin «gps»: cuenta por la etiqueta.
  assert.equal(isHere({ lat: 1, lon: 2, label: 'Tu ubicación' }), true);
  // Si buscaste una dirección, se respeta aunque estés lejos.
  const buscada = { lat: 36.84, lon: -2.46, label: 'Calle Real, Almería' };
  assert.equal(isHere(buscada), false);
  assert.equal(shouldRelocate(buscada, { lat: 40.41, lon: -3.7 }), false);
  // Datos raros: no hace nada.
  assert.equal(shouldRelocate(null, { lat: 1, lon: 1 }), false);
  assert.equal(shouldRelocate(almeria, { lat: NaN, lon: 1 }), false);
});
