// Registro de cambios de la app. La primera entrada es la versión actual.
// Al publicar algo nuevo: añade una entrada arriba y sube la versión
// (también en package.json; un test comprueba que coinciden).
//
// La app instalada en el móvil enseña su versión (este fichero, guardado por
// el service worker) y la del servidor publicado (/api/status), y avisa si no
// coinciden.

export const CHANGELOG = [
  {
    version: '1.7.1',
    date: '2026-11-20',
    changes: [
      'Arreglado: antes de las 10 de la mañana la línea «⏱ Precios» decía «hace 7 h» aunque los precios fueran de hace un momento (la hora del Ministerio viene con una sola cifra y se leía como medianoche).',
      'Precios en vivo: «🔄 Actualizar» pide al servidor que descargue ya los precios del Ministerio si los suyos tienen más de 5 minutos, y el aviso dice de qué hora son.',
      'Con la app abierta, cada 2 minutos (y al volver a ella) se comprueba si hay precios más nuevos y la lista se recarga sola, sin mover el mapa.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-11-19',
    changes: [
      'Actualizar la lista de adheridas con un clic: en Ajustes hay un botón «🍀 Enviar a Tréboles» para la barra de marcadores. Lo pulsas en el mapa oficial de Club MAPFRE, buscas cualquier ciudad y la app recibe la lista de toda España, sin HAR ni F12.',
      'Antes de guardar ves qué ha cambiado frente a tu lista: nuevas, las que ya no están en el mapa y las que cambian de tipo. Una lista de toda España sustituye a la anterior, así que las que MAPFRE quita dejan de dar tréboles.',
      'Si la lista tiene más de 2 meses, la línea «🍀 Adheridas» se pone en ámbar con un enlace para actualizarla.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-11-19',
    changes: [
      'Ruta: nuevo campo «Te quedan (L)». Con el consumo de tu vehículo calcula hasta qué km llegas (con un 15 % de margen) y «Te aconsejo» elige la mejor gasolinera antes de ese punto. Si te llega para todo el viaje o no llegas a ninguna, te lo dice.',
      'Corregidas 11 «Más EESS colaboradoras» cuyo nombre oficial es de una cadena (Enilive, Galp, Shell, BP…) pero estaban asignadas a una gasolinera de otra (p. ej. una Ballenoil en Rivas). La revisión automática también lo vigila.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-11-19',
    changes: [
      'Revisión automática de las adheridas: con cada descarga de precios del Ministerio (cada 30 min), si una «Gasolinera Repsol» del mapa oficial aparece con el rótulo de otra cadena (cambió de bandera), deja de dar tréboles sola o pasa a la Repsol de la misma calle.',
      'En Ajustes se ve qué ha cambiado la revisión y un aviso si la lista del mapa oficial tiene más de 2 meses.',
    ],
  },
  {
    version: '1.4.4',
    date: '2026-11-19',
    changes: [
      'A simple vista, bajo los filtros: hace cuánto son los precios que ves («⏱ Precios: hace 12 min») y de cuándo es la lista de adheridas, con cuántas hay. Si los precios tienen más de 3 horas, se avisa en ámbar.',
    ],
  },
  {
    version: '1.4.3',
    date: '2026-11-19',
    changes: [
      'Corregida la lista de adheridas: 35 «Gasolinera Repsol» del mapa oficial estaban asignadas a gasolineras de otra cadena (Plenergy, Petroprix, Ballenoil, Naturgy, Cepsa…) y daban tréboles que no dan. Dos pasan a su Repsol de verdad (p. ej. la de Av. Mediterráneo en Almería) y el resto se quitan.',
      'El cruce con el mapa oficial ya no puede atribuir una «Gasolinera Repsol» a otra cadena.',
      'Aunque tengas en el móvil una lista vieja importada, una «Gasolinera Repsol» en una gasolinera de otra cadena ya no da tréboles.',
      '«Te aconsejo» respeta el tipo elegido: con «Más EESS colaboradoras» no cuenta los tréboles de las Repsol (que exigen su tarjeta), y al revés.',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-11-19',
    changes: [
      '«Tus favoritas hoy» sigue el modo: en tu coche, las que menos te cuestan; en el de empresa, las que más tréboles te dan («+X 🍀»).',
      'El gasto del viaje en la ruta se calcula al precio de la gasolinera que te aconseja la app.',
    ],
  },
  {
    version: '1.4.1',
    date: '2026-11-19',
    changes: [
      'El buscador de direcciones ya no repite la misma sugerencia dos veces (p. ej. «Sevilla, Andalucía, España»).',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-11-19',
    changes: [
      'Tarjeta «Te aconsejo» arriba del todo (cerca y en la ruta): una sola gasolinera, la mejor para ti según el modo, con el porqué y el botón «Cómo llegar». En tu coche, la que menos te cuesta de verdad (tréboles, tope y desvío incluidos); en el de empresa, la que más tréboles te da.',
      'En tu coche los tréboles cuentan, pero si una sin tréboles te sale más barata, es la aconsejada; la tarjeta dice cuánto ahorras frente a la mejor con (o sin) tréboles.',
      'Busca entre todas las gasolineras abiertas, aunque tengas puesto «Solo Club MAPFRE», y se destaca en el mapa.',
      'La lista se ordena por defecto por «Lo mejor para ti», igual que la recomendación.',
    ],
  },
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
