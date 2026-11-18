import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNumber, parseResponse, parseFecha, histDate } from '../server/minetur.js';
import { fuelKeyForField } from '../shared/fuels.js';
import { generateDemoResponse } from '../server/demo.js';

const raw = JSON.parse(readFileSync(new URL('./fixtures/minetur-sample.json', import.meta.url)));

test('números con coma decimal', () => {
  assert.equal(parseNumber('1,459'), 1.459);
  assert.equal(parseNumber(' -3,711944 '), -3.711944);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber(null), null);
  assert.equal(parseNumber('abc'), null);
});

test('claves de carburante, incluidos campos nuevos', () => {
  assert.equal(fuelKeyForField('Precio Gasoleo A'), 'gasoleoA');
  assert.equal(fuelKeyForField('Precio Gases licuados del petróleo'), 'glp');
  assert.equal(fuelKeyForField('Precio Adblue'), 'adblue');
  assert.equal(fuelKeyForField('Precio Amoniaco'), 'amoniaco');
  assert.equal(fuelKeyForField('Precio Biogas Natural Comprimido'), 'biogasNaturalComprimido');
  assert.equal(fuelKeyForField('Precio Gasolina 95 E85'), 'gasolina95E85');
  assert.equal(fuelKeyForField('Rótulo'), null);
});

test('parsea la respuesta del Ministerio', () => {
  const { fecha, updatedAt, stations } = parseResponse(raw);
  assert.equal(fecha, '17/11/2026 21:30:05');
  assert.equal(updatedAt, '2026-11-17T21:30:05');
  assert.equal(stations.length, 4, 'la estación sin coordenadas se descarta');
  const galp = stations.find((s) => s.id === '1001');
  assert.equal(galp.brand, 'GALP');
  assert.equal(galp.address, 'Calle de la Princesa, 3');
  assert.equal(galp.lat, 40.423611);
  assert.equal(galp.lon, -3.711944);
  assert.deepEqual(galp.prices, { gasoleoA: 1.489, gasoleoP: 1.569, g95e5: 1.559, g98e5: 1.689 });
  const plenoil = stations.find((s) => s.id === '1002');
  assert.equal(plenoil.prices.adblue, 0.899);
  assert.equal(plenoil.prices.glp, 0.959);
  assert.equal(stations.find((s) => s.id === '1004').saleType, 'R');
  assert.equal(stations.find((s) => s.id === '1004').municipality, 'Arganda del Rey');
});

test('corrige coordenadas intercambiadas y descarta las que valen (0, 0)', () => {
  const base = { 'IDEESS': '7', 'Rótulo': 'X', 'IDProvincia': '36' };
  const swapped = parseResponse({ ListaEESSPrecio: [{ ...base, 'Latitud': '-8,659472', 'Longitud (WGS84)': '42,037472' }] });
  assert.equal(swapped.stations[0].lat, 42.037472);
  assert.equal(swapped.stations[0].lon, -8.659472);
  const zero = parseResponse({ ListaEESSPrecio: [{ ...base, 'Latitud': '0,000000', 'Longitud (WGS84)': '0,000000' }] });
  assert.equal(zero.stations.length, 0);
  const canarias = parseResponse({ ListaEESSPrecio: [{ ...base, 'Latitud': '28,123', 'Longitud (WGS84)': '-15,43' }] });
  assert.equal(canarias.stations.length, 1);
});

test('rechaza respuestas con error', () => {
  assert.throws(() => parseResponse({}), /ListaEESSPrecio/);
  assert.throws(() => parseResponse({ ListaEESSPrecio: [], ResultadoConsulta: 'ERROR' }), /ERROR/);
});

test('fechas', () => {
  assert.equal(parseFecha('01/02/2026 7:05:00'), '2026-02-01T07:05:00');
  assert.equal(parseFecha('basura'), null);
  assert.equal(histDate(new Date(2026, 0, 9)), '09-01-2026');
});

test('los datos de demostración tienen el mismo formato que la API', () => {
  const { stations } = parseResponse(generateDemoResponse(new Date(2026, 10, 17)));
  assert.ok(stations.length > 500);
  assert.ok(stations.every((s) => s.prices.gasoleoA > 1 && s.prices.gasoleoA < 2));
  assert.ok(stations.some((s) => s.brand === 'GALP'));
  assert.ok(stations.some((s) => s.saleType === 'R'));
});
