import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROGRAM, cloneProgram, brandMatches, findRule, percentFor, effectivePrice, treblesFor, daysUntilBoost,
  programExpired, fuelEligible, eligibleAmount, cappedAmount, weekStart, activePromos, mergeOfficial, migrateProgram,
  capStatus, waitAdvice, trebolStatus,
} from '../shared/treboles.js';

const st = (id, brand, idProvincia = '41') => ({ id, brand, idProvincia });

test('las marcas se comparan por palabras completas, sin tildes ni mayúsculas', () => {
  assert.ok(brandMatches('REPSOL', 'repsol'));
  assert.ok(brandMatches('ES DULANTZI REPSOL', 'REPSOL'));
  assert.ok(brandMatches('Campsa Express', 'CAMPSA'));
  assert.ok(!brandMatches('PETRONORA', 'PETRONOR'));
  assert.ok(!brandMatches('GALP', ''));
});

test('sin lista oficial: la red Repsol cuenta como adherida (aproximado) y Galp no', () => {
  assert.equal(findRule(st('1', 'REPSOL'))?.source, 'brand');
  assert.equal(findRule(st('2', 'PETRONOR'))?.id, 'repsol');
  assert.equal(findRule(st('3', 'GALP')), null);
  assert.equal(findRule(st('4', 'MOEVE')), null);
});

test('la lista oficial manda en las provincias que cubre', () => {
  const official = { provinces: ['41'], stations: { 10: { tipo: 'colaboradora', nombre: 'X' }, 11: { tipo: 'repsol' } } };
  assert.equal(findRule(st('10', 'BALLENOIL'), DEFAULT_PROGRAM, {}, official)?.source, 'official');
  assert.match(findRule(st('11', 'REPSOL'), DEFAULT_PROGRAM, {}, official).name, /Repsol/);
  // Repsol de Sevilla que no está en la lista: no cuenta
  assert.equal(findRule(st('12', 'REPSOL'), DEFAULT_PROGRAM, {}, official), null);
  // Repsol de Málaga (provincia no cubierta): aproximado por marca
  assert.equal(findRule(st('13', 'REPSOL', '29'), DEFAULT_PROGRAM, {}, official)?.source, 'brand');
  // Estación de la lista en una provincia no cubierta: cuenta igual
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

test('migración de ajustes guardados con las reglas antiguas (Galp activada)', () => {
  const old = {
    version: 1,
    trebolValue: 0.5,
    rules: [
      { id: 'galp', match: ['GALP'], enabled: true },
      { id: 'custom-1', name: 'Mi gasolinera', match: ['PEPE'], enabled: true, percent: 3 },
    ],
  };
  const p = migrateProgram(old);
  assert.equal(p.version, DEFAULT_PROGRAM.version);
  assert.equal(p.trebolValue, 0.5);
  assert.deepEqual(p.rules.map((r) => r.id), ['repsol', 'custom-1']);
  assert.equal(findRule(st('1', 'GALP'), p), null);
  // Misma versión: se respetan los cambios del usuario en las reglas de fábrica
  const same = cloneProgram();
  same.rules[0].enabled = false;
  assert.equal(migrateProgram(same).rules[0].enabled, false);
  assert.deepEqual(migrateProgram(undefined).rules.map((r) => r.id), ['repsol']);
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
