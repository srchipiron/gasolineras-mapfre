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
  const mono = (b) => { const s = brandStyle(b); return [s.key, s.mono, s.logo]; };
  assert.deepEqual(mono('LOW COST REPOST'), ['otra', 'LC', null]);
  assert.deepEqual(mono('ÁREA 117'), ['otra', 'A1', null]);
  assert.deepEqual(mono('BEROIL'), ['otra', 'BE', null]);
  assert.deepEqual(mono(''), ['otra', '⛽', null]);
});

test('cada marca tiene sus colores en la hoja de estilos', () => {
  const css = readFileSync(new URL('../public/css/app.css', import.meta.url), 'utf8');
  for (const k of [...BRAND_KEYS, 'otra']) assert.ok(css.includes(`.b-${k} {`) || css.includes(`.b-${k},`), `falta .b-${k}`);
});

test('ocultar una marca: por su clave o por la primera palabra', async () => {
  const { brandId } = await import('../shared/marcas.js');
  const { filterResults } = await import('../shared/ranking.js');
  assert.equal(brandId('REPSOL ALHAMBRA'), 'repsol');
  assert.equal(brandId('RASPAOIL ALMERIA'), 'RASPAOIL');
  const r = (brand) => ({ station: { brand }, mapfre: false });
  const list = [r('REPSOL'), r('REPSOL VIRGEN LLUC'), r('RASPAOIL ALMERIA'), r('PLENERGY')];
  const left = filterResults(list, { hiddenBrands: ['repsol', 'RASPAOIL'] }).map((x) => x.station.brand);
  assert.deepEqual(left, ['PLENERGY']);
  assert.equal(filterResults(list, {}).length, 4);
});

test('cada logotipo está en public/img/marcas', async () => {
  const { LOGOS } = await import('../shared/marcas.js');
  const { existsSync } = await import('node:fs');
  for (const [k, [file, shape]] of Object.entries(LOGOS)) {
    assert.ok(BRAND_KEYS.includes(k), `marca desconocida ${k}`);
    assert.ok(['sq', 'wide'].includes(shape), `forma ${shape}`);
    assert.ok(existsSync(new URL(`../public/img/marcas/${file}`, import.meta.url)), `falta ${file}`);
  }
});
