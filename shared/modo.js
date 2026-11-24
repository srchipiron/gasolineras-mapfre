// Dos modos: «Voy en mi coche» (el carburante lo pagas tú) y «Voy en el coche
// de empresa» (lo paga la empresa, pero los tréboles van a tu carnet).
// Cada modo recuerda su vehículo y su orden de la lista.

import { selectVehicle } from './vehiculos.js';

export const MODES = {
  personal: { icon: '🚗', label: 'Mi coche', long: 'Voy en mi coche' },
  company: { icon: '💼', label: 'Coche de empresa', long: 'Voy en el coche de empresa' },
};

export const isCompany = (s) => s?.mode === 'company';

/** Quién paga un repostaje del registro (los antiguos, tú). */
export const payerOf = (entry) => (entry?.payer === 'company' ? 'company' : 'personal');

/** Clave de ajustes con el orden de la lista en el modo actual. */
export const sortKey = (s) => (isCompany(s) ? 'companySort' : 'sort');

/** Órdenes de la ruta en cada modo, y la clave de ajustes donde se guarda. */
const ROUTE_SORTS = {
  personal: { total: 'Mejor para ti', effective: 'Con tréboles', along: 'Orden en la ruta' },
  company: { treboles: 'Más tréboles', along: 'Orden en la ruta' },
};
export const routeSorts = (s) => ROUTE_SORTS[isCompany(s) ? 'company' : 'personal'];
export const routeSortKey = (s) => (isCompany(s) ? 'companyRouteSort' : 'routeSort');

/** Cambia de modo y pasa al vehículo que usaste la última vez en ese modo. */
export function switchMode(s, mode) {
  if (!MODES[mode]) return s;
  s.vehicleByMode = { ...(s.vehicleByMode ?? {}), [s.mode ?? 'personal']: s.vehicleId };
  s.mode = mode;
  const remembered = s.vehicleByMode[mode];
  // Si el vehículo recordado ya no existe, se queda el actual.
  if (remembered && remembered !== s.vehicleId && s.vehicles?.some((v) => v.id === remembered)) selectVehicle(s, remembered);
  return s;
}

/** Importe del registro separado por quién pagó. Los tréboles son siempre tuyos. */
export function splitByPayer(entries) {
  const out = { personal: 0, company: 0 };
  for (const e of entries) out[payerOf(e)] += Number(e.amount) || 0;
  return out;
}
