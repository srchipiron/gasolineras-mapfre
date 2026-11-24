import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brandStyle, BRAND_KEYS } from '../shared/marcas.js';

test('reconoce la marca aunque el rótulo lleve apellido', () => {
  assert.equal(brandStyle('REPSOL').key, 'repsol');
  assert.equal(brandStyle('REPSOL - PRINCIPE DE VERGARA').key, 'repsol');
  assert.equal(brandStyle('BP GETAFE - M406').key, 'bp');
  assert.equal(brandStyle('GALP&GO').key, 'galp');
  assert.equal(brandStyle('E.LECLERC').key, 'leclerc');
  assert.equal(brandStyle('Alcampo').key, 'alcampo');
  assert.equal(brandStyle('STAR PETROLEUM').key, 'star');
  assert.equal(brandStyle('ENI').mono, 'eni');
});

test('no confunde palabras que solo empiezan igual', () => {
  assert.equal(brandStyle('BPX ENERGIA').key, 'otra');
  assert.equal(brandStyle('ESSOL').key, 'otra');
  assert.equal(brandStyle('AVIATION FUEL').key, 'otra');
});

test('las marcas sin colores propios llevan sus iniciales', () => {
  assert.deepEqual(brandStyle('LOW COST REPOST'), { key: 'otra', mono: 'LC' });
  assert.deepEqual(brandStyle('ÁREA 117'), { key: 'otra', mono: 'A1' });
  assert.deepEqual(brandStyle('BEROIL'), { key: 'otra', mono: 'BE' });
  assert.deepEqual(brandStyle(''), { key: 'otra', mono: '⛽' });
});

test('cada marca tiene sus colores en la hoja de estilos', () => {
  const css = readFileSync(new URL('../public/css/app.css', import.meta.url), 'utf8');
  for (const k of [...BRAND_KEYS, 'otra']) assert.ok(css.includes(`.b-${k} {`) || css.includes(`.b-${k},`), `falta .b-${k}`);
});
