import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROGRAM, cloneProgram, brandMatches, findRule, percentFor, effectivePrice, treblesFor, daysUntilBoost,
  programExpired, fuelEligible, eligibleAmount, cappedAmount, weekStart, activePromos, mergeOfficial, migrateProgram,
  capStatus, waitAdvice, trebolStatus, percentsIn,
} from '../shared/treboles.js';

const st = (id, brand, idProvincia = '41') => ({ id, brand, idProvincia });

test('las marcas se comparan por palabras completas, sin tildes ni mayúsculas', () => {
  assert.ok(brandMatches('REPSOL', 'repsol'));
  assert.ok(brandMatches('ES DULANTZI REPSOL', 'REPSOL'));
  assert.ok(brandMatches('Campsa Express', 'CAMPSA'));
  assert.ok(!brandMatches('PETRONORA', 'PETRONOR'));
  assert.ok(!brandMatches('GALP', ''));
});

test('no hay reglas por marca: sin lista oficial ninguna estación cuenta', () => {
  assert.deepEqual(DEFAULT_PROGRAM.rules, []);
  for (const b of ['REPSOL', 'GALP', 'MOEVE', 'PETRONOR']) assert.equal(findRule(st('1', b)), null, b);
});

test('porcentaje del texto de ventajas del mapa oficial', () => {
  assert.deepEqual(percentsIn('6% en Tréboles con la tarjeta REPSOL Carburante'), [6]);
  assert.deepEqual(percentsIn('Hasta un 6 % del 1 al 5 y un 3,5 % el resto'), [6, 3.5]);
  assert.deepEqual(percentsIn(''), []);
  assert.deepEqual(percentsIn(undefined), []);
  const official = { provinces: [], stations: { 9: { tipo: 'colaboradora', ventajas: '10% en Tréboles' }, 8: { tipo: 'colaboradora' } } };
  const r = findRule(st('9', 'REPSOL'), DEFAULT_PROGRAM, {}, official);
  assert.equal(percentFor(r, new Date(2026, 10, 18)), 10);
  assert.equal(percentFor(r, new Date(2026, 11, 2)), 10);
  const c = findRule(st('8', 'X'), DEFAULT_PROGRAM, {}, official);
  assert.equal(percentFor(c, new Date(2026, 10, 18)), 3);
  assert.equal(percentFor(c, new Date(2026, 11, 2)), 6);
  // «Hasta un 6 %» es el máximo del carnet: 3 % fuera de los días 1 a 5
  const hasta = { provinces: [], stations: { 7: { tipo: 'colaboradora', ventajas: 'Hasta un 6 % en Tréboles con tu carnet de socio' } } };
  const h = findRule(st('7', 'X'), DEFAULT_PROGRAM, {}, hasta);
  assert.equal(percentFor(h, new Date(2026, 10, 18)), 3);
  assert.equal(percentFor(h, new Date(2026, 11, 2)), 6);
  // Dos porcentajes: el mayor los días bonificados
  const dos = { provinces: [], stations: { 6: { tipo: 'colaboradora', ventajas: '5 % del 1 al 5 y 2 % el resto del mes' } } };
  const d = findRule(st('6', 'X'), DEFAULT_PROGRAM, {}, dos);
  assert.equal(percentFor(d, new Date(2026, 10, 18)), 2);
  assert.equal(percentFor(d, new Date(2026, 11, 3)), 5);
});

test('solo cuentan las «Más EESS colaboradoras»; las «Gasolinera Repsol» solo si se activan', () => {
  const official = { provinces: [], stations: { 1: { tipo: 'colaboradora' }, 2: { tipo: 'repsol' }, 3: { tipo: 'manual' } } };
  assert.equal(findRule(st('1', 'X'), DEFAULT_PROGRAM, {}, official)?.source, 'official');
  assert.equal(findRule(st('2', 'REPSOL'), DEFAULT_PROGRAM, {}, official), null);
  assert.equal(findRule(st('3', 'Y'), DEFAULT_PROGRAM, {}, official)?.source, 'official', 'añadida a mano');
  const conRepsol = { ...cloneProgram(), officialTypes: ['colaboradora', 'repsol'] };
  assert.equal(findRule(st('2', 'REPSOL'), conRepsol, {}, official)?.source, 'official');
  // Tu marca manual manda
  assert.equal(findRule(st('2', 'REPSOL'), DEFAULT_PROGRAM, { 2: 'in' }, official)?.source, 'manual');
  // La preferencia se conserva al cargar ajustes de la misma versión
  assert.deepEqual(migrateProgram(conRepsol).officialTypes, ['colaboradora', 'repsol']);
  assert.deepEqual(migrateProgram({ ...conRepsol, version: 4 }).officialTypes, ['colaboradora']);
});

test('solo cuentan las estaciones de la lista oficial', () => {
  const official = { provinces: ['41'], stations: { 10: { tipo: 'colaboradora', nombre: 'X' }, 11: { tipo: 'repsol' } } };
  assert.equal(findRule(st('10', 'BALLENOIL'), DEFAULT_PROGRAM, {}, official)?.source, 'official');
  const conRepsol = { ...cloneProgram(), officialTypes: ['colaboradora', 'repsol'] };
  assert.match(findRule(st('11', 'REPSOL'), conRepsol, {}, official).name, /Repsol/);
  assert.equal(findRule(st('12', 'REPSOL'), DEFAULT_PROGRAM, {}, official), null);
  assert.equal(findRule(st('13', 'REPSOL', '29'), DEFAULT_PROGRAM, {}, official), null);
  assert.equal(findRule(st('10', 'BALLENOIL', '29'), DEFAULT_PROGRAM, {}, official)?.source, 'official');
});

test('las marcas manuales mandan sobre todo', () => {
  const official = { provinces: ['41'], stations: { 10: { tipo: 'colaboradora' } } };
  assert.equal(findRule(st('10', 'X'), DEFAULT_PROGRAM, { 10: 'out' }, official), null);
  assert.equal(findRule(st('12', 'REPSOL'), DEFAULT_PROGRAM, { 12: 'in' }, official)?.source, 'manual');
});

test('6 % del día 1 al 5 y 3 % el resto del mes', () => {
  const r = DEFAULT_PROGRAM.official;
  assert.equal(percentFor(r, new Date(2026, 11, 1)), 6);
  assert.equal(percentFor(r, new Date(2026, 11, 5, 23, 59)), 6);
  assert.equal(percentFor(r, new Date(2026, 11, 6)), 3);
  assert.equal(percentFor(null, new Date()), 0);
});

test('GLP y GNC no dan tréboles', () => {
  assert.equal(fuelEligible(DEFAULT_PROGRAM, 'glp'), false);
  assert.equal(fuelEligible(DEFAULT_PROGRAM, 'gnc'), false);
  assert.equal(fuelEligible(DEFAULT_PROGRAM, 'gasoleoA'), true);
});

test('precio efectivo, tréboles y tope de 100 € al día', () => {
  assert.equal(effectivePrice(1.5, 3).toFixed(3), '1.455');
  assert.equal(effectivePrice(1.5, 6).toFixed(3), '1.410');
  assert.equal(effectivePrice(1.5, 6, 0.5).toFixed(3), '1.455');
  assert.equal(effectivePrice(null, 3), null);
  assert.equal(treblesFor(59.32, 3), 1.78);
  assert.equal(eligibleAmount(150, DEFAULT_PROGRAM), 100);
  // 80 L a 1,50 € = 120 €: solo 100 € dan tréboles -> 6 % de 100 € = 6 € en 80 L
  assert.equal(effectivePrice(1.5, 6, 1, { amountEur: 120, program: DEFAULT_PROGRAM }).toFixed(4), (1.5 - 6 / 80).toFixed(4));
});

test('tope semanal y diario sobre los repostajes registrados', () => {
  assert.equal(weekStart('2026-11-18'), '2026-11-16'); // miércoles -> lunes
  assert.equal(weekStart('2026-11-22'), '2026-11-16'); // domingo -> lunes
  const log = [
    { date: '2026-11-16', mapfre: true, amount: 100, eligibleAmount: 100 },
    { date: '2026-11-17', mapfre: true, amount: 100, eligibleAmount: 100 },
    { date: '2026-11-18', mapfre: true, amount: 70, eligibleAmount: 70 },
    { date: '2026-11-18', mapfre: false, amount: 500 },
    { date: '2026-11-10', mapfre: true, amount: 100 },
  ];
  assert.equal(cappedAmount(60, '2026-11-18', log), 30, 'quedan 30 € del día y 30 € de la semana');
  assert.equal(cappedAmount(60, '2026-11-19', log), 30, 'quedan 30 € de la semana');
  assert.equal(cappedAmount(60, '2026-11-23', log), 60, 'semana nueva');
  assert.equal(cappedAmount(150, '2026-11-23', []), 100, 'tope diario');
});

test('días hasta el próximo 6 % y caducidad', () => {
  assert.equal(daysUntilBoost(DEFAULT_PROGRAM.official, new Date(2026, 10, 18)), 13);
  assert.equal(daysUntilBoost(DEFAULT_PROGRAM.official, new Date(2026, 11, 3)), 0);
  assert.equal(programExpired(DEFAULT_PROGRAM, new Date(2026, 11, 31, 12)), false);
  assert.equal(programExpired(DEFAULT_PROGRAM, new Date(2027, 0, 1)), true);
});

test('promociones vigentes', () => {
  assert.equal(activePromos(DEFAULT_PROGRAM, new Date(2026, 10, 18)).length, 1);
  assert.equal(activePromos(DEFAULT_PROGRAM, new Date(2026, 11, 1)).length, 0);
});

test('unión de listas oficiales', () => {
  const m = mergeOfficial(
    { provinces: ['41'], stations: { 1: { tipo: 'repsol' } }, updatedAt: '2026-11-01' },
    { provinces: ['30', '41'], stations: { 2: { tipo: 'colaboradora' } }, updatedAt: '2026-11-18' },
    null,
  );
  assert.deepEqual(m.provinces, ['30', '41']);
  assert.deepEqual(Object.keys(m.stations), ['1', '2']);
  assert.equal(m.updatedAt, '2026-11-18');
});

test('migración: se descartan todas las reglas por marca guardadas', () => {
  const old = {
    version: 3,
    trebolValue: 0.5,
    rules: [
      { id: 'repsol', match: ['REPSOL'], enabled: true },
      { id: 'galp', match: ['GALP'], enabled: true },
      { id: 'custom-1', name: 'Mi gasolinera', match: ['PEPE'], enabled: true, percent: 3 },
    ],
  };
  const p = migrateProgram(old);
  assert.equal(p.version, DEFAULT_PROGRAM.version);
  assert.equal(p.trebolValue, 0.5);
  assert.deepEqual(p.rules, []);
  for (const b of ['REPSOL', 'GALP', 'PEPE']) assert.equal(findRule(st('1', b), p), null, b);
  assert.deepEqual(migrateProgram(undefined).rules, []);
});

test('estado del tope según los repostajes', () => {
  const log = [
    { date: '2026-11-16', mapfre: true, amount: 120, eligibleAmount: 100 },
    { date: '2026-11-18', mapfre: true, amount: 40, eligibleAmount: 40 },
    { date: '2026-11-18', mapfre: false, amount: 90 },
  ];
  const c = capStatus('2026-11-18', log);
  assert.deepEqual(c.day, { used: 40, cap: 100, left: 60 });
  assert.deepEqual(c.week, { used: 140, cap: 300, left: 160 });
  assert.equal(c.left, 60);
  assert.equal(capStatus('2026-11-23', log).left, 100, 'semana nueva');
});

test('asesor: ¿esperar al 6 %?', () => {
  const a = waitAdvice({ price: 1.5, litres: 40, now: new Date(2026, 10, 18) });
  assert.equal(a.boostNow, false);
  assert.equal(a.days, 13);
  assert.equal(a.nextBoost, '2026-12-01');
  assert.equal(a.extra, 1.8); // 3 % más de 60 €
  const b = waitAdvice({ price: 1.5, litres: 40, now: new Date(2026, 11, 3) });
  assert.equal(b.boostNow, true);
  assert.equal(b.daysLeft, 3);
  // Con 100 L a 1,50 € solo cuentan 100 € por el tope: 3 € extra
  assert.equal(waitAdvice({ price: 1.5, litres: 100, now: new Date(2026, 10, 18) }).extra, 3);
});

test('estado de los tréboles de un repostaje', () => {
  const e = { date: '2026-11-01', mapfre: true, treboles: 2 };
  assert.deepEqual(trebolStatus(e, '2026-11-05'), { kind: 'waiting', until: '2026-11-11' });
  assert.deepEqual(trebolStatus(e, '2026-11-12'), { kind: 'ask', left: 19 });
  assert.deepEqual(trebolStatus({ ...e, confirmed: true }, '2026-11-12'), { kind: 'ok' });
  assert.deepEqual(trebolStatus({ ...e, confirmed: false }, '2026-11-12'), { kind: 'claim', claimUntil: '2026-12-01', left: 19 });
  assert.equal(trebolStatus({ ...e, mapfre: false }, '2026-11-12'), null);
  assert.equal(trebolStatus({ ...e, treboles: 0 }, '2026-11-12'), null);
});
