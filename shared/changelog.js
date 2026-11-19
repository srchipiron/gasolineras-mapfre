// Registro de cambios de la app. La primera entrada es la versión actual.
// Al publicar algo nuevo: añade una entrada arriba y sube la versión
// (también en package.json; un test comprueba que coinciden).
//
// La app instalada en el móvil enseña su versión (este fichero, guardado por
// el service worker) y la del servidor publicado (/api/status), y avisa si no
// coinciden.

export const CHANGELOG = [
  {
    version: '1.3.0',
    date: '2026-11-19',
    changes: [
      'Dos modos: «Voy en mi coche» (pagas tú) y «Voy en el coche de empresa» (paga la empresa y los tréboles son tuyos). En el de empresa la lista pone primero las que más tréboles te dan y enseña cuánto le cuesta a la empresa.',
      'Cada modo recuerda su vehículo y su orden.',
      'Repostajes: «Pago yo» o «Paga la empresa» en cada uno, con lo que salió de tu bolsillo y lo que pagó la empresa por separado (también en el CSV).',
      'Registro de cambios y versión al final de Ajustes, con aviso si la app instalada no es la publicada.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-11-19',
    changes: [
      'La búsqueda de direcciones ya no falla con «Nominatim respondió 429»: se busca desde el móvil y, si falla, el servidor usa Photon de reserva.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-19',
    changes: [
      'La lista de gasolineras adheridas de toda España (3.386) va dentro de la app: ya no hay que pasar el fichero al móvil, y funciona sin conexión.',
      'Mejor cruce con el mapa oficial (carreteras como A-5 o N-IV y puntos kilométricos).',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-18',
    changes: [
      'Primera versión publicada: precio con tréboles, mapa, ruta, favoritas, registro de repostajes, carnet, copia de seguridad y lista de adheridas compartida.',
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;

/** Compara versiones «1.2.3»: negativo si a es anterior a b. */
export function compareVersions(a, b) {
  const pa = String(a ?? '0').split('.').map(Number);
  const pb = String(b ?? '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Estado de la app instalada frente a la publicada en el servidor. */
export function versionStatus(installed, published) {
  if (!published) return 'unknown';
  const d = compareVersions(installed, published);
  return d === 0 ? 'same' : d < 0 ? 'outdated' : 'ahead';
}
