// Consumo real del vehículo a partir de los repostajes, por el método «de
// lleno a lleno»: entre dos llenados con los km del cuentakilómetros, lo que
// echaste (contando los repostajes a medias de en medio) es lo que gastaste en
// esos km.

const n = (v) => Number(v);
const hasOdo = (e) => Number.isFinite(n(e.odometer)) && n(e.odometer) > 0;
const isFull = (e) => e.full !== false;

/** Repostajes de un vehículo, del más antiguo al más nuevo. */
function ofVehicle(log, vehicleId) {
  return (log ?? [])
    .filter((e) => e.vehicleId === vehicleId && n(e.litres) > 0)
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.date.localeCompare(b.e.date)
      || (hasOdo(a.e) && hasOdo(b.e) ? n(a.e.odometer) - n(b.e.odometer) : b.i - a.i))
    .map((x) => x.e);
}

/**
 * Consumo medio real (L/100 km y €/100 km) de un vehículo.
 * Devuelve null si aún no hay dos llenados con km.
 */
export function realConsumption(log, vehicleId, { min = 1, max = 50, minKm = 20 } = {}) {
  const segments = [];
  let anchor = null;
  let litres = 0, amount = 0;
  for (const e of ofVehicle(log, vehicleId)) {
    if (!anchor) {
      if (isFull(e) && hasOdo(e)) anchor = e;
      continue;
    }
    litres += n(e.litres);
    amount += n(e.amount) || 0;
    if (!hasOdo(e)) {
      // Un llenado sin km rompe la cuenta: no sabemos dónde estaba.
      if (isFull(e)) { anchor = null; litres = 0; amount = 0; }
      continue;
    }
    const km = n(e.odometer) - n(anchor.odometer);
    if (km <= 0) {
      // Km que no cuadran (cuentakilómetros cambiado o error al apuntar).
      anchor = isFull(e) ? e : null; litres = 0; amount = 0;
      continue;
    }
    if (!isFull(e)) continue;
    const l100 = (litres / km) * 100;
    if (km >= minKm && l100 >= min && l100 <= max) {
      segments.push({ from: anchor.date, to: e.date, km, litres, amount, l100 });
    }
    anchor = e; litres = 0; amount = 0;
  }
  if (!segments.length) return null;
  const sum = segments.reduce((t, s) => ({ km: t.km + s.km, litres: t.litres + s.litres, amount: t.amount + s.amount }), { km: 0, litres: 0, amount: 0 });
  return {
    l100: (sum.litres / sum.km) * 100,
    eur100: (sum.amount / sum.km) * 100,
    km: sum.km,
    litres: sum.litres,
    segments: segments.length,
    last: segments.at(-1),
  };
}

/** Último cuentakilómetros apuntado para el vehículo (o null). */
export function lastOdometer(log, vehicleId) {
  const withOdo = ofVehicle(log, vehicleId).filter(hasOdo);
  return withOdo.length ? n(withOdo.at(-1).odometer) : null;
}

/** Consumo redondeado a una décima, como se guarda en el vehículo. */
export const roundConsumption = (l100) => Math.round(l100 * 10) / 10;
