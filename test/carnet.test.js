import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCardNumber, isEan13, barcodeFormat, groupNumber } from '../shared/carnet.js';

test('número de socio normalizado', () => {
  assert.equal(normalizeCardNumber(' 1234 5678-9012.3456 '), '1234567890123456');
  assert.equal(normalizeCardNumber('ab-12 cd'), 'AB12CD');
  assert.equal(normalizeCardNumber('<script>1</script>'), 'SCRIPT1SCRIPT');
  assert.equal(normalizeCardNumber(null), '');
  assert.equal(normalizeCardNumber('9'.repeat(60)).length, 40);
});

test('EAN-13 y formato del código de barras', () => {
  assert.equal(isEan13('4006381333931'), true);
  assert.equal(isEan13('4006381333932'), false);
  assert.equal(isEan13('123'), false);
  assert.equal(barcodeFormat('4006381333931'), 'EAN13');
  assert.equal(barcodeFormat('4006381333931', 'CODE128'), 'CODE128');
  assert.equal(barcodeFormat('1234567890123456'), 'CODE128');
  assert.equal(barcodeFormat('AB12CD', 'EAN13'), 'CODE128', 'EAN-13 solo si el número lo es');
});

test('número agrupado de 4 en 4', () => {
  assert.equal(groupNumber('1234567890123456'), '1234 5678 9012 3456');
  assert.equal(groupNumber('12345'), '1234 5');
});
