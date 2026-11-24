// Registro de cambios de la app. La primera entrada es la versión actual.
// Al publicar algo nuevo: añade una entrada arriba y sube la versión
// (también en package.json; un test comprueba que coinciden).
//
// La app instalada en el móvil enseña su versión (este fichero, guardado por
// el service worker) y la del servidor publicado (/api/status), y avisa si no
// coinciden.

export const CHANGELOG = [
  {
    version: '1.12.1',
    date: '2026-11-24',
    changes: [
      '«Te aconsejo» se pinta con los colores de la gasolinera que te aconseja (naranja y rojo si es Repsol, rojo si es Alcampo…), con su emblema y su nombre en grande de fondo, también con el coche de empresa.',
      '«Mejor para ti» y «Más barata» llevan una franja y un toque del color de su marca, con su emblema.',
      'Arreglado: el nombre de fondo de la ficha salía con el rótulo entero en vez de solo la marca.',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-11-24',
    changes: [
      'La ficha de cada gasolinera se viste con los colores de su marca: naranja y rojo en Repsol, rojo en Cepsa y Alcampo, verde y amarillo en BP, amarillo en Shell, azul en Ballenoil y Carrefour… con su emblema, el nombre en grande de fondo y, arriba, si está abierta, el precio de tu carburante y el % en tréboles.',
      'En la lista, cada gasolinera lleva el emblema de su marca con su puesto en una burbuja (la primera, en lima). También en «Te aconsejo» y en «La más barata de cada marca».',
      'Al bajar por la ficha, la cabecera se encoge y se queda arriba con el nombre y el botón de cerrar.',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-11-24',
    changes: [
      'Consumo real: al registrar un repostaje puedes apuntar los km del cuentakilómetros y si llenas el depósito. Con dos llenados, en Repostajes ves cuánto gasta de verdad tu vehículo (L/100 km y € cada 100 km), contando los repostajes a medias de en medio.',
      'Si tu consumo real no coincide con el de Ajustes, un botón lo pone en tu vehículo para que el plan de repostaje de la ruta y el gasto del viaje usen lo que gastas de verdad.',
      'Al apuntar los km te dice cuántos llevas desde el último repostaje, y los km salen en el historial y en el CSV.',
      'Arreglado: en «Registrar repostaje», los botones «Pago yo» / «Paga la empresa» enseñaban un círculo grande además de la marca ✓.',
    ],
  },
  {
    version: '1.10.2',
    date: '2026-11-24',
    changes: [
      'Al abrir la app, si la última vez buscaste «cerca de mí», mira dónde estás ahora y, si te has movido más de 1 km, te enseña las gasolineras de donde estás (antes salían las del último sitio). Si buscaste una dirección, la respeta. No pide permisos: solo funciona si ya diste permiso de ubicación.',
    ],
  },
  {
    version: '1.10.1',
    date: '2026-11-24',
    changes: [
      'Al final de la página: «Creado por Javier Álvarez», con un botón a su LinkedIn.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-11-23',
    changes: [
      'Diseño nuevo «Trébol»: cabecera verde bosque con un trébol, la búsqueda en una tarjeta encima y colores de papel cálido con verde lima. En oscuro, verde casi negro.',
      'Las pestañas pasan abajo, al alcance del pulgar, con iconos como en una app de Android (Cerca, Ruta, Favoritas, Repostajes, Ajustes).',
      '«Te aconsejo» es ahora la tarjeta protagonista, en verde oscuro con el precio grande en lima (en azul con el coche de empresa).',
      'Precios como en el surtidor: la tercera cifra, pequeña y en alto (1,62⁹ €).',
      'Los filtros son píldoras que se rellenan al activarlos, y el plan de repostaje de la ruta se ve como una línea de tiempo.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-11-23',
    changes: [
      'Diseño nuevo, inspirado en ClaraRed: cabecera flotante de cristal, filtros en píldoras que se deslizan en una fila, mapa en una tarjeta redondeada, pestañas en píldora que se quedan arriba al bajar y fichas que suben desde abajo. Colores azul pizarra con el verde de los tréboles.',
      'Botón de tema arriba (🌗 automático, ☀️ claro, 🌙 oscuro): por defecto sigue al móvil. El mapa también se oscurece en el tema oscuro.',
      'Arriba, «Mi carnet» y «Actualizar» pasan a ser iconos (🪪 y 🔄, que gira mientras actualiza) y el aviso de tréboles va en su propia línea. Los modos se llaman «Mi coche» y «Coche de empresa».',
    ],
  },
  {
    version: '1.8.4',
    date: '2026-11-23',
    changes: [
      'El plan de repostaje solo te manda a gasolineras abiertas a la hora a la que pasas (las de pueblo que cierran a mediodía, de noche o el domingo ya no salen). Pones a qué hora sales (si es una hora que ya pasó, entiende que sales mañana) y, en tus tracks, tu velocidad media (60 km/h por defecto). Cada parada dice a qué hora pasas, y en marcha, a qué hora llegas a la siguiente.',
    ],
  },
  {
    version: '1.8.3',
    date: '2026-11-23',
    changes: [
      '«▶️ Seguir» en el plan de repostaje: con la tablet en el soporte, el GPS va diciendo por qué km vas y cuánto falta para la próxima parada sin tocar nada, la pantalla no se apaga y vibra con un aviso 5 km antes de cada parada.',
    ],
  },
  {
    version: '1.8.2',
    date: '2026-11-23',
    changes: [
      '«📍 Dónde estoy» en el plan de repostaje: con la ruta en marcha, un toque y te dice por qué km vas, cuánto falta para la próxima parada y los litros que llevarás si has llenado donde decía el plan (en ámbar si ya vas en reserva). Las paradas hechas se marcan con ✔️. En las rutas circulares distingue la salida de la llegada.',
    ],
  },
  {
    version: '1.8.1',
    date: '2026-11-23',
    changes: [
      'En las rutas siempre sales con el depósito lleno: el plan de repostaje parte lleno desde el inicio (o desde la gasolinera de la ruta donde hayas llenado hoy). Se quita el campo «Te quedan (L)».',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-11-23',
    changes: [
      'Mis rutas (pestaña Ruta): carga el track GPX o KML de tu ruta en moto (Wikiloc, Calimoto, Kurviger, Google My Maps…). Se queda guardada en el móvil para repetirla con un toque, también al revés.',
      'Plan de repostaje «tipo Tesla»: con el depósito y el consumo de tu vehículo, te dice en qué km entras en reserva y en qué gasolineras parar a llenar para gastar lo menos posible sin bajar nunca de la reserva (cuánto llegas, cuánto echas y cuánto pagas en cada una). Las paradas se destacan en el mapa.',
      'Si registras un repostaje (hoy o ayer) en una gasolinera de la ruta abierta, el plan sale de ahí con el depósito lleno y te avisa de dónde toca el siguiente llenado.',
      'En Ajustes, los litros del vehículo pasan a llamarse «Depósito (L)»: es lo que cabe al llenar.',
    ],
  },
  {
    version: '1.7.2',
    date: '2026-11-20',
    changes: [
      'Ya no se esconden gasolineras en el mapa: si dos están casi pegadas (p. ej. la Easygas y la Gueroil de Cajiz, una a cada lado de la A-7) y su pin caía en el mismo sitio, la de debajo no se veía. Ahora se aparta un poco (con borde punteado) para que se vean las dos.',
    ],
  },
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
