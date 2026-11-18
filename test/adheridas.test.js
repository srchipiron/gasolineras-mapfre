import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseLocatorPayload } from '../shared/locator.js';
import { matchEntries, provinceSummary, normalizeOfficial, createOfficialSource, similarity } from '../server/adheridas.js';
import { parseResponse } from '../server/minetur.js';

const read = (f) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url)));
const locator = read('localizador-sample.json');
const { stations } = parseResponse(read('minetur-sample.json'));

test('lee la respuesta del localizador: tipos, comas decimales y duplicados', () => {
  const entries = parseLocatorPayload(locator);
  assert.equal(entries.length, 3, 'el duplicado se elimina');
  assert.deepEqual(entries[0], {
    nombre: 'E.S. GALP PRINCESA', tipo: 'colaboradora', direccion: 'C/ Princesa 3', localidad: 'MADRID', ventajas: '3% en Tréboles', lat: 40.42365, lon: -3.7119,
  });
  assert.equal(entries[1].tipo, 'repsol');
});

test('lee un HAR y solo mira las respuestas del localizador', () => {
  const text = JSON.stringify(locator);
  const har = {
    log: {
      entries: [
        { request: { url: 'https://www.mapfretecuidamos.com/inc/js/jquery.min.js', headers: [{ name: 'Cookie', value: 'secreto' }] }, response: { content: { text: 'no es json' } } },
        { request: { url: 'https://x.mapfre.com/serviciostecuidamos/collaborating-center' }, response: { content: { text } } },
        { request: { url: 'https://x.mapfre.com/serviciostecuidamos/collaborating-center' }, response: { content: { text: Buffer.from(text).toString('base64'), encoding: 'base64' } } },
        { request: { url: 'https://x.mapfre.com/serviciostecuidamos/collaborating-center' }, response: { content: {} } },
      ],
    },
  };
  const entries = parseLocatorPayload(har);
  assert.equal(entries.length, 3);
  assert.ok(!JSON.stringify(entries).includes('secreto'));
});

test('acepta listas sueltas y descarta lo que no tiene coordenadas', () => {
  const entries = parseLocatorPayload([{ nombreCentro: 'A', latitud: 37.1, longitud: -5.9 }, { nombreCentro: 'B' }, 'texto', null]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].tipo, 'colaboradora');
});

test('empareja con la gasolinera del Ministerio más cercana', () => {
  const { matched, unmatched } = matchEntries(parseLocatorPayload(locator), stations);
  assert.deepEqual(matched.map((m) => [m.id, m.tipo]), [['1001', 'colaboradora'], ['1003', 'repsol']]);
  assert.ok(matched.every((m) => m.distanceM < 100));
  assert.equal(matched[0].idProvincia, '28');
  assert.deepEqual(unmatched.map((u) => u.nombre), ['GASOLINERA LEJANA']);
  assert.deepEqual(provinceSummary(matched), [{ idProvincia: '28', province: 'Madrid', count: 2 }]);
});

test('no empareja si la gasolinera está demasiado lejos', () => {
  const far = [{ nombre: 'X', tipo: 'colaboradora', direccion: '', localidad: '', lat: 40.4275, lon: -3.7119 }]; // ~430 m
  assert.equal(matchEntries(far, stations).matched.length, 0);
});

test('con dos entradas para la misma gasolinera, gana la más cercana', () => {
  const two = [
    { nombre: 'LEJOS', tipo: 'colaboradora', direccion: '', localidad: '', lat: 40.4250, lon: -3.7119 },
    { nombre: 'CERCA', tipo: 'repsol', direccion: '', localidad: '', lat: 40.4237, lon: -3.7119 },
  ];
  const { matched } = matchEntries(two, stations);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].nombre, 'CERCA');
});

test('valida la lista compartida', () => {
  const o = normalizeOfficial({
    updatedAt: '2026-11-18', provinces: ['04', 'xx', '30'],
    stations: { 123: { tipo: 'repsol', nombre: 'A' }, 'mal id!': { tipo: 'repsol' }, 9: { tipo: 'raro' } },
  });
  assert.deepEqual(o.provinces, ['04', '30']);
  assert.deepEqual(Object.keys(o.stations).sort(), ['123', '9']);
  assert.equal(o.stations['9'].tipo, 'colaboradora');
  assert.deepEqual(normalizeOfficial(null).stations, {});
});

test('la lista compartida se relee cuando cambia el fichero', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'adheridas-'));
  const file = join(dir, 'adheridas.json');
  const src = createOfficialSource(file);
  assert.deepEqual((await src.get()).stations, {}, 'sin fichero, lista vacía');
  writeFileSync(file, JSON.stringify({ provinces: ['41'], stations: { 1: { tipo: 'repsol' } } }));
  assert.deepEqual((await src.get()).provinces, ['41']);
});

test('no atribuye una estación oficial a la gasolinera de al lado (caso Plenergy)', () => {
  // A ~120 m de la Plenoil 1002 (Avenida del Arco de la Victoria), pero con otro nombre y otra calle.
  const vecina = [{ nombre: 'E.S. SAN ROQUE', tipo: 'colaboradora', direccion: 'Calle Mayor 5', localidad: 'MADRID', lat: 40.4361, lon: -3.7203 }];
  const { matched, unmatched } = matchEntries(vecina, stations);
  assert.equal(matched.length, 0);
  assert.equal(unmatched.length, 1);
});

test('empareja por calle y número aunque las coordenadas del mapa oficial estén algo desplazadas', () => {
  const desplazada = [{ nombre: 'ESTACION X', tipo: 'colaboradora', direccion: 'AVDA. DE LA PRINCESA, 3', localidad: 'MADRID', lat: 40.4270, lon: -3.7140 }]; // ~400 m
  const { matched } = matchEntries(desplazada, stations);
  assert.deepEqual(matched.map((m) => [m.id, m.por]), [['1001', 'dirección']]);
});

test('similitud entre una estación oficial y una del Ministerio', () => {
  const s = stations.find((x) => x.id === '1001'); // GALP · Calle de la Princesa, 3
  assert.deepEqual(similarity({ nombre: 'E.S. GALP', direccion: 'C/ Princesa 3' }, s), { street: 1, number: true, name: true });
  assert.deepEqual(similarity({ nombre: 'E.S. SAN ROQUE', direccion: 'Calle Mayor 5' }, s), { street: 0, number: false, name: false });
});

test('si dos estaciones oficiales caen en la misma gasolinera, la peor queda para revisar', () => {
  const dos = [
    { nombre: 'OTRA', tipo: 'colaboradora', direccion: '', localidad: '', lat: 40.42362, lon: -3.71195 }, // ~1 m, solo posición
    { nombre: 'E.S. GALP', tipo: 'colaboradora', direccion: 'Calle Princesa 3', localidad: 'MADRID', lat: 40.4239, lon: -3.7119 },
  ];
  const { matched, unmatched } = matchEntries(dos, stations);
  assert.deepEqual(matched.map((m) => m.nombre), ['E.S. GALP']);
  assert.deepEqual(unmatched.map((u) => u.nombre), ['OTRA']);
});
