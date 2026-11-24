import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entrySaving, savingsSummary } from '../shared/ahorro.js';

test('ahorro de un repostaje frente a la media de la zona', () => {
  assert.equal(entrySaving({ areaAvg: 1.62, price: 1.5, litres: 40 }), 4.8);
  assert.equal(entrySaving({ areaAvg: 1.5, price: 1.55, litres: 20 }), -1);
  assert.equal(entrySaving({ price: 1.5, litres: 40 }), null, 'repostajes viejos, sin media');
  assert.equal(entrySaving({ areaAvg: 1.6, price: 0, litres: 40 }), null);
});

test('resumen: solo cuentan los que tienen media', () => {
  const s = savingsSummary([
    { areaAvg: 1.62, price: 1.5, litres: 40 },
    { areaAvg: 1.5, price: 1.55, litres: 20 },
    { price: 1.4, litres: 30 },
  ]);
  assert.deepEqual({ ...s, perLitre: Math.round(s.perLitre * 1000) / 1000 }, { total: 3.8, n: 2, litres: 60, perLitre: 0.063 });
  assert.equal(savingsSummary([{ price: 1.4, litres: 30 }]), null);
  assert.equal(savingsSummary([]), null);
});
