import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enrich, sortResults, compareCompany, recommend } from '../shared/ranking.js';
import { cloneProgram } from '../shared/treboles.js';
import { switchMode, splitByPayer, payerOf, sortKey, routeSortKey, isCompany } from '../shared/modo.js';
import { ensureVehicles, addVehicle, selectVehicle } from '../shared/vehiculos.js';
import { CHANGELOG, APP_VERSION, compareVersions, versionStatus } from '../shared/changelog.js';

const st = (id, price, distanceKm) => ({ id, brand: `G${id}`, prices: { gasoleoA: price }, distanceKm, schedule: '' });
// A y B adheridas (marcadas a mano), C no adherida y la más barata.
const stations = [st('A', 1.5, 1), st('B', 1.4, 5), st('C', 1.3, 0.5)];
const opts = { fuel: 'gasoleoA', program: cloneProgram(), overrides: { A: 'in', B: 'in' }, litres: 40, consumption: 6.5, now: new Date('2026-11-10T12:00:00') };

test('coche de empresa: primero las que dan tréboles y, entre iguales, la que menos cuesta a la empresa', () => {
  const list = enrich(stations, opts);
  assert.deepEqual(sortResults(list, 'treboles').map((r) => r.station.id), ['B', 'A', 'C']);
  // En mi coche manda el precio con tréboles: C (sin tréboles) sigue siendo la más barata.
  assert.equal(sortResults(list, 'effective')[0].station.id, 'C');
  const c = compareCompany(list);
  assert.equal(c.best.station.id, 'B');
  assert.equal(c.cheapest.station.id, 'C');
  assert.ok(c.extraForCompany > 0);
  // La empresa paga el surtidor entero: los tréboles no se le descuentan.
  const b = list.find((r) => r.station.id === 'B');
  assert.ok(Math.abs(b.pumpCost - (40 * 1.4 + b.detourCost)) < 1e-9);
});

test('te aconseja la mejor para ti según el modo, y nunca una cerrada', () => {
  const list = enrich(stations, opts);
  // Tu coche: la que menos te cuesta de verdad (C, sin tréboles pero más barata y cerca).
  const mine = recommend(list);
  assert.equal(mine.best.station.id, 'C');
  assert.equal(mine.nearest.station.id, 'C');
  assert.ok(mine.savingVsNext > 0);
  // Los tréboles cuentan, pero si una sin tréboles sale más barata, gana ella
  // y se explica frente a la mejor con tréboles.
  assert.equal(mine.rival.station.id, 'B');
  assert.ok(mine.savingVsRival > 0);
  // Si la adherida baja de precio, pasa a ser la aconsejada por sus tréboles.
  const cheapB = enrich([st('A', 1.5, 1), st('B', 1.3, 0.5), st('C', 1.3, 0.5)], opts);
  const r2 = recommend(cheapB);
  assert.equal(r2.best.station.id, 'B');
  assert.equal(r2.rival.station.id, 'C');
  // Coche de empresa: la que más tréboles te da y menos cuesta a la empresa.
  const work = recommend(list, { company: true });
  assert.equal(work.best.station.id, 'B');
  assert.equal(work.cheapestForCompany.station.id, 'C');
  assert.ok(work.extraForCompany > 0);
  // Si la mejor está cerrada, pasa a la siguiente.
  const closed = list.map((r) => (r.station.id === 'C' ? { ...r, open: false } : r));
  assert.notEqual(recommend(closed).best.station.id, 'C');
  assert.equal(recommend([]), null);
});

test('con un tipo elegido, los tréboles de las demás no cuentan para «Te aconsejo»', () => {
  // B es «Gasolinera Repsol» (6 % con su tarjeta) y A colaboradora; C sin tréboles.
  const official = { stations: { A: { tipo: 'colaboradora', nombre: 'A' }, B: { tipo: 'repsol', nombre: 'B' } } };
  const list = enrich(stations, { ...opts, overrides: {}, official });
  const all = recommend(list, { company: true });
  assert.equal(all.best.station.id, 'B');
  const colab = recommend(list, { company: true, tipo: 'colaboradora' });
  assert.equal(colab.best.station.id, 'A', 'la Repsol no cuenta si filtras colaboradoras');
});

test('una lista vieja con una «Gasolinera Repsol» en una Plenergy no da tréboles', () => {
  const official = { stations: { P: { tipo: 'repsol', nombre: 'CRED X', ventajas: '6% en Tréboles' } } };
  const [r] = enrich([{ ...st('P', 1.5, 1), brand: 'PLENERGY' }], { ...opts, overrides: {}, official });
  assert.equal(r.treboles, 0);
  const [ok] = enrich([{ ...st('P', 1.5, 1), brand: 'REPSOL' }], { ...opts, overrides: {}, official });
  assert.ok(ok.treboles > 0);
});

test('sin adheridas en la zona no hay «mejor para ti»', () => {
  const c = compareCompany(enrich(stations, { ...opts, overrides: {} }));
  assert.equal(c.best, null);
  assert.equal(c.cheapest.station.id, 'C');
});

test('cada modo recuerda su vehículo y su orden', () => {
  const s = ensureVehicles({ fuel: 'g95e5', litres: 40, consumption: 6, vehicles: [], mode: 'personal' });
  const company = addVehicle(s, { name: 'Coche de empresa', icon: '🚙', fuel: 'gasoleoA', litres: 50, consumption: 5.5 });
  assert.equal(sortKey(s), 'sort');
  switchMode(s, 'company');
  assert.ok(isCompany(s));
  assert.equal(sortKey(s), 'companySort');
  assert.equal(routeSortKey(s), 'companyRouteSort');
  selectVehicle(s, company);
  assert.equal(s.fuel, 'gasoleoA');
  switchMode(s, 'personal');
  assert.equal(s.vehicleId, 'v1');
  assert.equal(s.fuel, 'g95e5');
  switchMode(s, 'company');
  assert.equal(s.vehicleId, company);
  assert.equal(s.litres, 50);
});

test('el registro separa lo que pagas tú de lo que paga la empresa', () => {
  const log = [{ amount: 60 }, { amount: 70, payer: 'company' }, { amount: 10, payer: 'personal' }];
  assert.deepEqual(splitByPayer(log), { personal: 70, company: 70 });
  assert.equal(payerOf({}), 'personal');
});

test('registro de cambios: versión actual, orden y comparación con la publicada', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(APP_VERSION, pkg.version, 'sube también la versión de package.json');
  for (let i = 1; i < CHANGELOG.length; i++) assert.ok(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version) > 0);
  assert.ok(CHANGELOG.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.changes.length));
  assert.equal(versionStatus('1.3.0', '1.3.0'), 'same');
  assert.equal(versionStatus('1.2.0', '1.10.0'), 'outdated');
  assert.equal(versionStatus('1.3.0', '1.2.0'), 'ahead');
  assert.equal(versionStatus('1.3.0', null), 'unknown');
});
