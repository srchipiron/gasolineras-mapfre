// Copia de seguridad de los datos guardados en el dispositivo (lista oficial
// importada, favoritas, repostajes, carnet, vehículos y ajustes) para pasarlos
// a otro móvil, a otro navegador o a la app instalada.

export const BACKUP_APP = 'gasolineras-mapfre';
const MAX_BYTES = 5_000_000;

/** Crea la copia con las claves indicadas del almacenamiento (localStorage). */
export function makeBackup(storage, keys, now = new Date()) {
  const data = {};
  for (const k of keys) {
    const v = storage.getItem(k);
    if (v == null) continue;
    try {
      data[k] = JSON.parse(v);
    } catch {
      /* valor estropeado: no se copia */
    }
  }
  return { app: BACKUP_APP, version: 1, savedAt: now.toISOString(), data };
}

/** Lee y valida una copia. Solo se aceptan las claves conocidas. */
export function parseBackup(text, keys) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('El fichero es demasiado grande para ser una copia');
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('El fichero no es una copia válida (no es JSON)');
  }
  if (obj?.app !== BACKUP_APP || !obj.data || typeof obj.data !== 'object') throw new Error('El fichero no es una copia de esta app');
  const data = {};
  for (const k of keys) if (Object.hasOwn(obj.data, k) && obj.data[k] != null) data[k] = obj.data[k];
  if (!Object.keys(data).length) throw new Error('La copia está vacía');
  return { savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : null, data };
}

/** Escribe la copia en el almacenamiento. Devuelve cuántas claves se restauraron. */
export function restoreBackup(storage, backup) {
  let n = 0;
  for (const [k, v] of Object.entries(backup.data)) {
    storage.setItem(k, JSON.stringify(v));
    n++;
  }
  return n;
}

/** Resumen legible de lo que hay en una copia. */
export function backupSummary(data, KEYS) {
  const parts = [];
  const official = Object.keys(data[KEYS.official]?.stations ?? {}).length;
  if (official) parts.push(`lista oficial con ${official} gasolineras`);
  const favs = Array.isArray(data[KEYS.favorites]) ? data[KEYS.favorites].length : 0;
  if (favs) parts.push(`${favs} favoritas`);
  const log = Array.isArray(data[KEYS.log]) ? data[KEYS.log].length : 0;
  if (log) parts.push(`${log} repostajes`);
  if (data[KEYS.card]?.number) parts.push('carnet');
  const vehicles = data[KEYS.settings]?.vehicles?.length ?? 0;
  if (vehicles) parts.push(`${vehicles} ${vehicles === 1 ? 'vehículo' : 'vehículos'}`);
  if (data[KEYS.settings] && !vehicles) parts.push('ajustes');
  return parts.join(' · ') || 'ajustes';
}
