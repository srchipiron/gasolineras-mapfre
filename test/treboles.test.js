import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROGRAM, cloneProgram, brandMatches, findRule, percentFor, effectivePrice, treblesFor, daysUntilBoost, programExpired,
} from '../shared/treboles.js';

test('las marcas se comparan por palabras completas, sin tildes ni mayúsculas', () => {
  assert.ok(brandMatches('GALP', 'galp'));
  assert.ok(brandMatches('Galp Energía', 'GALP'));
  assert.ok(brandMatches('E.S. GALP & GO', 'GALP'));
  assert.ok(!brandMatches('GALPAGOS', 'GALP'));
  assert.ok(brandMatches('Estación Cepsa', 'cepsa'));
  assert.ok(!brandMatches('GALP', ''));
});

test('por defecto solo cuenta Galp; Repsol y Moeve se activan en Ajustes', () => {
  assert.equal(findRule({ id: '1', brand: 'GALP' })?.id, 'galp');
  assert.equal(findRule({ id: '2', brand: 'REPSOL' }), null);
  const p = cloneProgram();
  p.rules.find((r) => r.id === 'repsol').enabled = true;
  assert.equal(findRule({ id: '2', brand: 'REPSOL' }, p)?.id, 'repsol');
});

test('las marcas manuales mandan sobre las reglas', () => {
  assert.equal(findRule({ id: '1', brand: 'GALP' }, DEFAULT_PROGRAM, { 1: 'out' }), null);
  assert.equal(findRule({ id: '9', brand: 'BALLENOIL' }, DEFAULT_PROGRAM, { 9: 'in' })?.id, 'manual');
});

test('6 % del día 1 al 5 y 3 % el resto del mes', () => {
  const galp = DEFAULT_PROGRAM.rules[0];
  assert.equal(percentFor(galp, new Date(2026, 11, 1)), 6);
  assert.equal(percentFor(galp, new Date(2026, 11, 5, 23, 59)), 6);
  assert.equal(percentFor(galp, new Date(2026, 11, 6)), 3);
  assert.equal(percentFor(galp, new Date(2026, 10, 30)), 3);
  assert.equal(percentFor(null, new Date()), 0);
});

test('precio efectivo y tréboles', () => {
  assert.equal(effectivePrice(1.5, 3).toFixed(3), '1.455');
  assert.equal(effectivePrice(1.5, 6).toFixed(3), '1.410');
  assert.equal(effectivePrice(1.5, 6, 0.5).toFixed(3), '1.455'); // trébol valorado a 0,50 €
  assert.equal(effectivePrice(null, 3), null);
  assert.equal(treblesFor(60, 3), 1.8);
  assert.equal(treblesFor(59.32, 3), 1.78);
});

test('días hasta el próximo 6 %', () => {
  const galp = DEFAULT_PROGRAM.rules[0];
  assert.equal(daysUntilBoost(galp, new Date(2026, 10, 17)), 14);
  assert.equal(daysUntilBoost(galp, new Date(2026, 11, 3)), 0);
  assert.equal(daysUntilBoost(galp, new Date(2026, 11, 31)), 1);
});

test('caducidad de la oferta', () => {
  assert.equal(programExpired(DEFAULT_PROGRAM, new Date(2026, 11, 31, 12)), false);
  assert.equal(programExpired(DEFAULT_PROGRAM, new Date(2027, 0, 1)), true);
});
