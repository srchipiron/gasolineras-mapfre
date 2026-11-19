import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseLocatorPayload } from '../shared/locator.js';
import { matchEntries, provinceSummary, normalizeOfficial, createOfficialSource, similarity, brandConflict, createReviewedSource } from '../server/adheridas.js';
import { review } from '../scripts/revisar-adheridas.mjs';
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
    { nombre: 'CERCA', tipo: 'colaboradora', direccion: '', localidad: '', lat: 40.4237, lon: -3.7119 },
  ];
  const { matched } = matchEntries(two, stations);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].nombre, 'CERCA');
});

test('una «Gasolinera Repsol» nunca se empareja con otra cadena (Galp, Plenergy…)', () => {
  // A 0 m de la Galp del ejemplo: aun así no se atribuye a ella.
  const e = [{ nombre: 'CRED X', tipo: 'repsol', direccion: '', localidad: '', lat: 40.423611, lon: -3.7119 }];
  assert.equal(matchEntries(e, stations).matched.length, 0);
  assert.equal(matchEntries([{ ...e[0], tipo: 'colaboradora' }], stations).matched.length, 1);
  assert.ok(brandConflict('repsol', 'PLENERGY'));
  assert.ok(!brandConflict('repsol', 'E.S. SANTA RITA'));
  assert.ok(!brandConflict('repsol', 'PETROCAT'));
  assert.ok(!brandConflict('colaboradora', 'PLENERGY'));
  // Colaboradoras: si el nombre oficial dice una cadena y el rótulo es de otra.
  assert.ok(brandConflict('colaboradora', 'BALLENOIL', 'ENILIVE OP. RIVAS 2'));
  assert.ok(brandConflict('colaboradora', 'CEPSA ATALAYA 365', 'SHELL ATALAYA 365'));
  assert.ok(!brandConflict('colaboradora', 'MOEVE', 'CEPSA LA PAZ'), 'Moeve es la antigua Cepsa');
  assert.ok(!brandConflict('colaboradora', 'REPSOL', 'E.S. VALCARCE S.L.'), 'nombre de empresa, no cadena');
});

test('la revisión pasa la Repsol de otra cadena a la Repsol de la misma calle', () => {
  const list = { version: 1, stations: { P: { tipo: 'repsol', nombre: 'CRED AVDA. DEL MEDITERRANEO' }, Q: { tipo: 'repsol', nombre: 'CRED OTRA' } } };
  const st = [
    { id: 'P', brand: 'PLENERGY', address: 'Avenida Mediterraneo, 184', lat: 36.8378, lon: -2.4471 },
    { id: 'R', brand: 'REPSOL', address: 'Avenida Mediterraneo, S/N', lat: 36.8273, lon: -2.4450 },
    { id: 'Q', brand: 'PETROPRIX', address: 'Calle Lejana, 1', lat: 37.5, lon: -2.4 },
  ];
  const res = review(list, st);
  assert.deepEqual(Object.keys(res.list.stations), ['R']);
  assert.equal(res.moved.length, 1);
  assert.equal(res.removed.length, 1);
});

test('el servidor revisa solo la lista con cada descarga del Ministerio', async () => {
  const base = { version: 1, updatedAt: '2026-11-19', stations: { P: { tipo: 'repsol', nombre: 'CRED AVDA. DEL MEDITERRANEO' }, C: { tipo: 'colaboradora', nombre: 'X' } } };
  const source = { get: async () => base };
  const store = {
    ready: true, fecha: '19/11/2026 18:00:00', fetchedAt: 'a',
    stations: [
      { id: 'P', brand: 'REPSOL', address: 'Avenida Mediterraneo, 184', lat: 36.8378, lon: -2.4471 },
      { id: 'C', brand: 'PLENERGY', address: 'Calle Y', lat: 36.9, lon: -2.4 },
    ],
  };
  const reviewed = createReviewedSource(source, store);
  let o = await reviewed.get();
  assert.deepEqual(Object.keys(o.stations).sort(), ['C', 'P'], 'todo en orden: no cambia nada (las colaboradoras pueden ser de cualquier cadena)');
  assert.equal(o.revision.quitadas, 0);
  assert.equal(await reviewed.get(), o, 'sin datos nuevos, misma respuesta');
  // Media hora después, la Repsol aparece con rótulo de otra cadena.
  store.stations = [{ ...store.stations[0], brand: 'PETROPRIX' }, store.stations[1]];
  store.fetchedAt = 'b';
  o = await reviewed.get();
  assert.deepEqual(Object.keys(o.stations), ['C']);
  assert.equal(o.revision.quitadas, 1);
  assert.match(o.revision.ejemplos[0], /PETROPRIX/);
  assert.equal(Object.keys(base.stations).length, 2, 'la lista original no se toca');
  // Sin precios todavía, la lista se sirve tal cual.
  assert.equal(await createReviewedSource(source, { ready: false, stations: [] }).get(), base);
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

test('localizador real: ventajas como lista y acentos mal decodificados', () => {
  const [e] = parseLocatorPayload({ message: { contenido: [{
    nombreCentro: 'E.S. EJEMPLO', codigoTipoColaborador: '4', direccion: 'CR A-5, 104,3 IZQUIERDO', localidad: 'CAZALEGAS',
    latitud: 40, longitud: -4.6,
    ventajas: [{ codigo: null, descripcion: '6% en TrÃ©boles.' }, { codigo: null, descripcion: 'Con la tarjeta REPSOL Carburante.' }],
  }] } });
  assert.equal(e.tipo, 'repsol');
  assert.equal(e.ventajas, '6% en Tréboles. Con la tarjeta REPSOL Carburante');
});

test('empareja por código de carretera y punto kilométrico', () => {
  const s = { id: '9001', lat: 40, lon: -4.6, brand: 'REPSOL', address: 'Cr A-5, 104,3', locality: 'Cazalegas', province: 'Toledo', idProvincia: '45' };
  assert.deepEqual(similarity({ nombre: 'CRED CAZALEGAS', direccion: 'CR A-5, 104,3 IZQUIERDO' }, s), { street: 1, number: true, name: false });
  const lejos = [{ nombre: 'X', tipo: 'repsol', direccion: 'CR A-5, 104,3 IZQUIERDO', localidad: '', lat: 40.003, lon: -4.6 }]; // ~330 m
  assert.deepEqual(matchEntries(lejos, [s]).matched.map((m) => [m.id, m.por]), [['9001', 'dirección']]);
  // Otra carretera con el mismo kilómetro no vale
  const otra = [{ nombre: 'X', tipo: 'repsol', direccion: 'CR N-5, 104,3', localidad: '', lat: 40.003, lon: -4.6 }];
  assert.equal(matchEntries(otra, [s]).matched.length, 0);
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
