import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedule, isOpenAt, is24h, openStatus } from '../shared/horario.js';

// 2026-11-16 es lunes.
const at = (day, hh, mm = 0) => new Date(2026, 10, 16 + day, hh, mm);

test('24H todos los días', () => {
  const w = parseSchedule('L-D: 24H');
  assert.ok(is24h(w));
  assert.equal(isOpenAt(w, at(6, 3)), true);
  assert.equal(openStatus('L-D: 24H', at(2, 4)).label, 'Abierta 24 h');
});

test('horario distinto entre semana y sábado, cerrado el domingo', () => {
  const s = 'L-V: 06:00-22:00; S: 07:00-15:00';
  assert.equal(isOpenAt(s, at(0, 6)), true);
  assert.equal(isOpenAt(s, at(0, 5, 59)), false);
  assert.equal(isOpenAt(s, at(4, 21, 59)), true);
  assert.equal(isOpenAt(s, at(4, 22)), false);
  assert.equal(isOpenAt(s, at(5, 14)), true);
  assert.equal(isOpenAt(s, at(5, 16)), false);
  assert.equal(isOpenAt(s, at(6, 12)), false);
  assert.equal(openStatus(s, at(5, 16)).label, 'Cerrada · abre el lunes a las 06:00');
  assert.equal(openStatus(s, at(0, 10)).label, 'Abierta · cierra a las 22:00');
});

test('jornada partida con "y"', () => {
  const s = 'L-V: 07:00-14:30 y 16:00-21:00; S: 08:00-14:00';
  assert.equal(isOpenAt(s, at(1, 15)), false);
  assert.equal(isOpenAt(s, at(1, 16, 30)), true);
  assert.equal(openStatus(s, at(1, 15)).label, 'Cerrada · abre hoy a las 16:00');
});

test('horario que cruza la medianoche', () => {
  const s = 'L-D: 22:00-06:00';
  assert.equal(isOpenAt(s, at(0, 23)), true);
  assert.equal(isOpenAt(s, at(1, 3)), true);
  assert.equal(isOpenAt(s, at(1, 12)), false);
  assert.equal(openStatus(s, at(1, 3)).label, 'Abierta · cierra a las 06:00');
});

test('días sueltos y rangos que dan la vuelta a la semana', () => {
  const w = parseSchedule('S-L: 09:00-13:00');
  assert.equal(w[5].length, 1);
  assert.equal(w[6].length, 1);
  assert.equal(w[0].length, 1);
  assert.equal(w[2].length, 0);
  assert.equal(isOpenAt('L, X, V: 08:00-20:00', at(2, 10)), true);
  assert.equal(isOpenAt('L, X, V: 08:00-20:00', at(1, 10)), false);
});

test('textos vacíos o raros devuelven null (desconocido)', () => {
  assert.equal(parseSchedule(''), null);
  assert.equal(parseSchedule(null), null);
  assert.equal(isOpenAt('consultar', at(0, 10)), null);
  assert.equal(openStatus('???').open, null);
});

test('"L:" a secas es ambiguo (¿solo lunes o toda la semana?): desconocido', () => {
  assert.equal(parseSchedule('L: 24H'), null);
  assert.equal(parseSchedule('L: 06:00-22:00'), null);
  assert.equal(isOpenAt('L: 06:00-22:00', at(1, 10)), null);
  assert.notEqual(parseSchedule('L: 06:00-22:00; M: 06:00-22:00'), null);
});

test('hasta las 24:00', () => {
  assert.equal(isOpenAt('L-D: 06:00-24:00', at(3, 23, 59)), true);
  assert.equal(isOpenAt('L-D: 06:00-24:00', at(3, 5)), false);
});
