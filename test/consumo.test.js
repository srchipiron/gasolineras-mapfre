import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realConsumption, lastOdometer, roundConsumption } from '../shared/consumo.js';

const r = (date, litres, odometer, extra = {}) => ({ date, litres, amount: litres * 1.5, odometer, vehicleId: 'moto', ...extra });

test('consumo real de lleno a lleno', () => {
  // El historial se guarda del más nuevo al más antiguo.
  const log = [r('2026-11-20', 12, 10500), r('2026-11-10', 8, 10250), r('2026-11-01', 10, 10000)];
  const c = realConsumption(log, 'moto');
  // 8 + 12 L en 500 km
  assert.equal(c.km, 500);
  assert.equal(c.litres, 20);
  assert.equal(roundConsumption(c.l100), 4);
  assert.equal(c.eur100, 6);
  assert.equal(c.segments, 2);
  assert.equal(c.last.km, 250);
});

test('los repostajes a medias cuentan los litros hasta el siguiente lleno', () => {
  const log = [
    r('2026-11-20', 10, 10400),
    r('2026-11-15', 5, null, { full: false }),
    r('2026-11-10', 4, 10150, { full: false }),
    r('2026-11-01', 10, 10000),
  ];
  const c = realConsumption(log, 'moto');
  assert.equal(c.segments, 1);
  assert.equal(c.km, 400);
  assert.equal(c.litres, 19);
});

test('sin datos suficientes, km que no cuadran u otro vehículo: no inventa', () => {
  assert.equal(realConsumption([], 'moto'), null);
  assert.equal(realConsumption([r('2026-11-01', 10, 10000)], 'moto'), null);
  // Repostajes viejos sin vehículo ni km
  assert.equal(realConsumption([{ date: '2026-11-02', litres: 10 }, { date: '2026-11-01', litres: 10 }], 'moto'), null);
  // Cuentakilómetros hacia atrás
  assert.equal(realConsumption([r('2026-11-10', 10, 9000), r('2026-11-01', 10, 10000)], 'moto'), null);
  // Un llenado sin km rompe la cuenta
  assert.equal(realConsumption([r('2026-11-20', 10, 10500), r('2026-11-10', 10, null), r('2026-11-01', 10, 10000)], 'moto'), null);
  // Absurdo (60 L en 50 km) o muy pocos km
  assert.equal(realConsumption([r('2026-11-10', 60, 10050), r('2026-11-01', 10, 10000)], 'moto'), null);
  assert.equal(realConsumption([r('2026-11-10', 1, 10010), r('2026-11-01', 10, 10000)], 'moto'), null);
  // Otro vehículo
  assert.equal(realConsumption([r('2026-11-10', 10, 10250), r('2026-11-01', 10, 10000)], 'coche'), null);
});

test('mismo día: ordena por los km', () => {
  const log = [r('2026-11-01', 10, 10000), r('2026-11-01', 10, 10250)];
  assert.equal(realConsumption(log, 'moto').km, 250);
});

test('último cuentakilómetros apuntado', () => {
  assert.equal(lastOdometer([r('2026-11-20', 5, null), r('2026-11-10', 5, 10250), r('2026-11-01', 5, 10000)], 'moto'), 10250);
  assert.equal(lastOdometer([], 'moto'), null);
});
