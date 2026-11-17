import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { haversineKm, distanceToPolyline, simplifyPolyline, cumulativeKm } from '../shared/geo.js';
import { enrich, filterResults, sortResults, summarize, priceLevel } from '../shared/ranking.js';
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
  const opts = { fuel: 'gasoleoA', program, litres: 40, consumption: 6, now: new Date(2026, 11, 2) }; // día 2: 6 %
  const list = enrich(near, opts);
  const galp = list.find((r) => r.station.id === '1001');
  assert.equal(galp.mapfre, true);
  assert.equal(galp.percent, 6);
  assert.equal(galp.effective.toFixed(4), (1.489 * 0.94).toFixed(4));
  assert.equal(galp.treboles, Math.round(1.489 * 40 * 6) / 100);
  const sorted = sortResults(list, 'effective');
  // Con 6 %: Galp 1,3997 € vs Plenoil 1,429 € -> Galp primero
  assert.equal(sorted[0].station.id, '1001');
  // El día 20 (3 %): Galp 1,4443 € -> Plenoil primero
  const later = sortResults(enrich(near, { ...opts, now: new Date(2026, 11, 20) }), 'effective');
  assert.equal(later[0].station.id, '1002');
  // Por precio de surtidor siempre gana Plenoil
  assert.equal(sortResults(list, 'price')[0].station.id, '1002');
});

test('resumen y filtros', () => {
  const near = nearby(stations, { ...MADRID, radiusKm: 50 });
  const list = enrich(near, { fuel: 'gasoleoA', program: cloneProgram(), now: new Date(2026, 11, 20, 12) });
  assert.equal(filterResults(list, { hideRestricted: true }).length, 3);
  assert.equal(filterResults(list, { hideRestricted: false }).length, 4);
  assert.equal(filterResults(list, { onlyMapfre: true }).length, 1);
  const s = summarize(filterResults(list));
  assert.equal(s.count, 3);
  assert.equal(s.mapfreCount, 1);
  assert.equal(s.min, 1.429);
  assert.equal(s.max, 1.519);
  assert.equal(s.bestMapfre.station.id, '1001');
  assert.equal(s.bestNonMapfre.station.id, '1002');
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
