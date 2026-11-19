// Perfiles de vehículo: cada uno con su carburante, litros por repostaje y
// consumo. El vehículo en uso fija esos tres valores en los ajustes.

export const VEHICLE_ICONS = ['🚗', '🏍️', '🚙', '🚐', '🛻', '🚚'];

const clampNum = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Crea el primer vehículo con los ajustes actuales si aún no hay ninguno. */
export function ensureVehicles(s) {
  if (!Array.isArray(s.vehicles) || !s.vehicles.length) {
    s.vehicles = [{ id: 'v1', name: 'Mi coche', icon: '🚗', fuel: s.fuel, litres: s.litres, consumption: s.consumption }];
    s.vehicleId = 'v1';
  }
  if (!s.vehicles.some((v) => v.id === s.vehicleId)) s.vehicleId = s.vehicles[0].id;
  return s;
}

export function activeVehicle(s) {
  return s.vehicles?.find((v) => v.id === s.vehicleId) ?? s.vehicles?.[0] ?? null;
}

/** Cambia de vehículo y aplica su carburante, litros y consumo. */
export function selectVehicle(s, id) {
  if (!s.vehicles.some((v) => v.id === id)) return s;
  s.vehicleId = id;
  // Cada modo (mi coche / coche de empresa) recuerda su vehículo.
  s.vehicleByMode = { ...(s.vehicleByMode ?? {}), [s.mode ?? 'personal']: id };
  const v = activeVehicle(s);
  s.fuel = v.fuel;
  s.litres = v.litres;
  s.consumption = v.consumption;
  return s;
}

/** Guarda en el vehículo en uso los valores actuales de los ajustes. */
export function syncActiveVehicle(s) {
  const v = activeVehicle(s);
  if (v) Object.assign(v, { fuel: s.fuel, litres: s.litres, consumption: s.consumption });
  return s;
}

export function addVehicle(s, data = {}) {
  const id = `v${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  s.vehicles.push({
    id,
    name: String(data.name ?? 'Otro vehículo').slice(0, 40),
    icon: VEHICLE_ICONS.includes(data.icon) ? data.icon : '🏍️',
    fuel: data.fuel ?? s.fuel,
    litres: clampNum(data.litres, 1, 1000, 15),
    consumption: clampNum(data.consumption, 1, 50, 4),
  });
  return id;
}

export function updateVehicle(s, id, patch) {
  const v = s.vehicles.find((x) => x.id === id);
  if (!v) return s;
  if (patch.name !== undefined) v.name = String(patch.name).trim().slice(0, 40) || 'Vehículo';
  if (patch.icon !== undefined && VEHICLE_ICONS.includes(patch.icon)) v.icon = patch.icon;
  if (patch.fuel !== undefined) v.fuel = patch.fuel;
  if (patch.litres !== undefined) v.litres = clampNum(patch.litres, 1, 1000, v.litres);
  if (patch.consumption !== undefined) v.consumption = clampNum(patch.consumption, 1, 50, v.consumption);
  if (id === s.vehicleId) selectVehicle(s, id);
  return s;
}

/** Borra un vehículo (siempre queda al menos uno). */
export function removeVehicle(s, id) {
  if (s.vehicles.length <= 1) return s;
  s.vehicles = s.vehicles.filter((v) => v.id !== id);
  if (s.vehicleId === id) selectVehicle(s, s.vehicles[0].id);
  return s;
}
