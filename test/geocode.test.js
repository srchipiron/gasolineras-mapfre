import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNominatim, parsePhoton, photonUrl } from '../shared/geocode.js';
import { createGeocoder } from '../server/services.js';
import { FetchError } from '../server/http.js';

const quiet = { warn() {} };
const nominatim = [{ display_name: 'Sevilla, Andalucía, España', lat: '37.3886', lon: '-5.9823' }];
const photon = {
  features: [
    { properties: { name: 'Avenida de la Constitución', city: 'Sevilla', postcode: '41004', state: 'Andalucía', countrycode: 'ES' }, geometry: { coordinates: [-5.994, 37.3856] } },
    { properties: { name: 'Avenida de la Constitución', city: 'Sevilla', postcode: '41004', state: 'Andalucía', countrycode: 'ES' }, geometry: { coordinates: [-5.994, 37.3856] } },
    { properties: { name: 'Rua da Constituição', city: 'Porto', countrycode: 'PT' }, geometry: { coordinates: [-8.6, 41.16] } },
  ],
};

test('lee las respuestas de Nominatim y de Photon', () => {
  assert.deepEqual(parseNominatim(nominatim), [{ label: 'Sevilla, Andalucía, España', lat: 37.3886, lon: -5.9823 }]);
  // Photon: sin duplicados y solo España
  assert.deepEqual(parsePhoton(photon), [{ label: 'Avenida de la Constitución, 41004 Sevilla, Andalucía', lat: 37.3856, lon: -5.994 }]);
  assert.deepEqual(parsePhoton({}), []);
  assert.match(photonUrl('a b'), /bbox=-18\.4,27\.4,4\.6,44\.0&q=a%20b$/);
});

test('si Nominatim responde 429 se usa Photon y se deja descansar a Nominatim', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(new URL(url).host);
    if (url.includes('nominatim')) throw new FetchError('nominatim.openstreetmap.org respondió 429', { status: 429 });
    return photon;
  };
  const g = createGeocoder({ fetchImpl, minIntervalMs: 0, logger: quiet });
  assert.equal((await g.search('Constitución Sevilla'))[0].lat, 37.3856);
  await g.search('Otra calle');
  // La segunda búsqueda ya no pregunta a Nominatim (bloqueado un minuto)
  assert.deepEqual(calls, ['nominatim.openstreetmap.org', 'photon.komoot.io', 'photon.komoot.io']);
});

test('con Nominatim funcionando no se llama a Photon; si fallan los dos, se ve el error de Nominatim', async () => {
  const ok = createGeocoder({ fetchImpl: async () => nominatim, minIntervalMs: 0, logger: quiet });
  assert.equal((await ok.search('Sevilla'))[0].label, 'Sevilla, Andalucía, España');
  const fail = createGeocoder({
    fetchImpl: async (url) => { throw new FetchError(`${new URL(url).host} respondió 503`, { status: 503 }); },
    minIntervalMs: 0, logger: quiet,
  });
  await assert.rejects(fail.search('Sevilla'), /nominatim\.openstreetmap\.org respondió 503/);
});
