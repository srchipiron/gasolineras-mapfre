import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spreadPins } from '../shared/pins.js';

// Pin con precio: 64 × 26 px, ancla a 30 px.
const pin = (x, y, lat, lon) => ({ x, y, w: 64, h: 26, ay: 30, lat, lon });
const box = (p, dy) => ({ x1: p.x - p.w / 2, x2: p.x + p.w / 2, y1: p.y - p.ay + dy, y2: p.y - p.ay + dy + p.h });
const overlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

test('Easygas y Gueroil de Cajiz (a 130 m, mismo precio) ya no se tapan', () => {
  // A zoom de barrio caen a 3 px una de otra.
  const gueroil = pin(500, 300, 36.7445, -4.179083);
  const easygas = pin(498, 302, 36.743306, -4.18);
  const [d1, d2] = spreadPins([gueroil, easygas]);
  assert.equal(d1, 0, 'la primera no se mueve');
  assert.notEqual(d2, 0);
  assert.ok(!overlap(box(gueroil, d1), box(easygas, d2)));
});

test('varias pegadas se reparten sin solaparse', () => {
  const pins = [0, 1, 2, 3].map((k) => pin(200 + k, 200 + k, 40 + k * 0.0001, -3));
  const dys = spreadPins(pins);
  for (let a = 0; a < pins.length; a++)
    for (let b = a + 1; b < pins.length; b++) assert.ok(!overlap(box(pins[a], dys[a]), box(pins[b], dys[b])), `${a} y ${b}`);
});

test('las que solo coinciden por estar lejos con poco zoom no se mueven', () => {
  // 5 km de separación real: se separan al acercar el mapa.
  const dys = spreadPins([pin(100, 100, 40, -3), pin(102, 101, 40.045, -3)]);
  assert.deepEqual(dys, [0, 0]);
});

test('sin solape no se mueve nada', () => {
  assert.deepEqual(spreadPins([pin(0, 0, 40, -3), pin(200, 0, 40.0005, -3)]), [0, 0]);
});
