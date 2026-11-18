import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureVehicles, activeVehicle, selectVehicle, syncActiveVehicle, addVehicle, updateVehicle, removeVehicle } from '../shared/vehiculos.js';

const base = () => ({ fuel: 'gasoleoA', litres: 40, consumption: 6.5 });

test('crea el primer vehículo con los ajustes actuales', () => {
  const s = ensureVehicles(base());
  assert.equal(s.vehicles.length, 1);
  assert.deepEqual(activeVehicle(s), { id: 'v1', name: 'Mi coche', icon: '🚗', fuel: 'gasoleoA', litres: 40, consumption: 6.5 });
  // Idempotente
  assert.equal(ensureVehicles(s).vehicles.length, 1);
});

test('cambiar de vehículo aplica su carburante, litros y consumo', () => {
  const s = ensureVehicles(base());
  const moto = addVehicle(s, { name: 'Moto', icon: '🏍️', fuel: 'g95e5', litres: 12, consumption: 4 });
  selectVehicle(s, moto);
  assert.equal(s.vehicleId, moto);
  assert.deepEqual([s.fuel, s.litres, s.consumption], ['g95e5', 12, 4]);
  selectVehicle(s, 'v1');
  assert.deepEqual([s.fuel, s.litres, s.consumption], ['gasoleoA', 40, 6.5]);
  selectVehicle(s, 'no-existe');
  assert.equal(s.vehicleId, 'v1');
});

test('editar el vehículo en uso actualiza los ajustes; los valores se acotan', () => {
  const s = ensureVehicles(base());
  updateVehicle(s, 'v1', { litres: '55', consumption: '999', name: '  ', icon: '🛸' });
  const v = activeVehicle(s);
  assert.equal(v.litres, 55);
  assert.equal(v.consumption, 50);
  assert.equal(v.name, 'Vehículo');
  assert.equal(v.icon, '🚗', 'icono no permitido');
  assert.equal(s.litres, 55);
  s.fuel = 'g98e5';
  syncActiveVehicle(s);
  assert.equal(activeVehicle(s).fuel, 'g98e5');
});

test('siempre queda al menos un vehículo', () => {
  const s = ensureVehicles(base());
  removeVehicle(s, 'v1');
  assert.equal(s.vehicles.length, 1);
  const moto = addVehicle(s, { fuel: 'g95e5', litres: 12, consumption: 4 });
  removeVehicle(s, 'v1');
  assert.deepEqual(s.vehicles.map((v) => v.id), [moto]);
  assert.equal(s.vehicleId, moto);
  assert.equal(s.fuel, 'g95e5');
});
