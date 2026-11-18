# Repostar con Tréboles 🍀⛽

Aplicación web (instalable en el móvil) para encontrar la **gasolinera más barata de España teniendo en cuenta los tréboles de Club MAPFRE**.

No basta con mirar el precio del surtidor: en las gasolineras adheridas al programa *Ahorro al Repostar* te devuelven un porcentaje en tréboles, así que la app calcula el **precio efectivo** (lo que de verdad te cuesta cada litro) y te dice si compensa ir a una gasolinera de Club MAPFRE o a una *low cost* que no lo es.

> App no oficial, sin relación con MAPFRE. Los precios vienen del Ministerio para la Transición Ecológica. Comprueba siempre las condiciones y las estaciones adheridas en la web o la app de Club MAPFRE.

## Funcionalidades

**Búsqueda**
- Gasolineras cerca de tu ubicación (GPS) o de una dirección, ciudad o código postal.
- Todos los carburantes del Ministerio: diésel, gasolina 95/98, premium, GLP, GNC, GNL, AdBlue, hidrógeno…
- Radio de búsqueda de 2 a 50 km.
- **Todas las gasolineras por defecto** (Alcampo, Petroprix, Plenoil…) con las adheridas marcadas con 🍀 y su precio con tréboles, para comparar de un vistazo. Filtros: «Solo Club MAPFRE» (con el tipo del mapa oficial), abiertas ahora y ocultar las de venta restringida (cooperativas y flotas).
- Cuatro órdenes: precio con tréboles, precio en surtidor, **coste real** (incluye la gasolina que gastas en ir y volver) y distancia.
- **Tendencia**: ▲▼ con lo que ha subido o bajado cada gasolinera desde ayer, y la variación media de la zona. El servidor descarga una vez al día los precios de ayer del Ministerio.
- **Precio medio de tu provincia (14 días)**: gráfico del precio medio del carburante en la provincia de la búsqueda y si está subiendo, bajando o estable en la última semana, comparado con toda España. Es lo que ha pasado, no una predicción. El servidor guarda solo la media de cada día de los datos diarios del Ministerio.
- **Tus favoritas hoy**: en la pantalla principal, tus tres favoritas más baratas hoy, con 🔔 si alguna está por debajo de tu precio objetivo.
- **Vehículos**: coche, moto…, cada uno con su carburante, litros por repostaje y consumo, y un selector junto a los filtros para cambiar de uno a otro.

**Club MAPFRE**
- Precio efectivo por litro con el porcentaje de tréboles del día: **6 % del día 1 al 5** de cada mes y **3 % el resto**.
- Comparativa directa entre la mejor de Club MAPFRE y la más barata sin tréboles, con la diferencia en €/L y en € por depósito.
- Aviso de cuándo es día de 6 % y cuántos días faltan para el siguiente.
- **Solo dan tréboles las adheridas de verdad**: las de la lista oficial del mapa de Club MAPFRE (importada desde un HAR) y las que marques tú; nada por la marca.
- **Modo marcar**: botón «＋ Adherida» / «✓ Adherida» en cada gasolinera de la lista para revisarlas rápido.
- Condiciones reales del programa: GLP y GNC no dan tréboles, y hay un tope de 100 € al día y 300 € a la semana.
- Aviso de cuándo es día de 6 %, de las promociones del mes y de cuándo caduca la oferta.
- **Asesor «¿reposto hoy o espero?»**: cuántos tréboles más ganarías esperando al día 1, y recordatorio mensual para tu calendario (.ics).
- **Tope restante**: cuánto te queda hoy y esta semana de los 100 € / 300 € que dan tréboles. Los precios con tréboles lo tienen en cuenta.
- **Tu experiencia en cada gasolinera**: «✓ Me dieron tréboles» / «✗ No me los dieron» y notas privadas. El veredicto cuenta como marca de adherida o no adherida.

**Mapa y ficha**
- Mapa con precios de colores (verde barata, ámbar media, rojo cara) y la mejor opción destacada.
- Ficha de cada gasolinera: horario y si está abierta, todos los precios con y sin tréboles, y gráfico de los últimos 30 días.
- Botones para ir con Google Maps, Waze o Apple Maps, y para compartir.

**Ruta**
- Gasolineras a lo largo de un viaje (p. ej. Madrid → Valencia), con desvío máximo de 1 a 10 km.
- Ordenadas por precio con tréboles, por coste real o por el orden en que te las encuentras.

**Lo tuyo**
- **Gasto del viaje** en el modo ruta: litros y euros del trayecto con el consumo de tu vehículo, al precio de la mejor gasolinera de la ruta y a precio medio, e ida y vuelta.
- **Mi carnet**: guarda tu número de socio de Club MAPFRE y enséñalo en caja a pantalla completa con QR, código de barras (Code 128, o EAN-13 si tu número lo es) y el número en grande. La pantalla no se apaga mientras está abierto. Botón «🪪 Mi carnet» arriba, en la ficha de cada adherida y como acceso directo del icono.
- Favoritas con **aviso de precio objetivo**: al abrir la app te avisa si alguna ha bajado de tu precio.
- **Registro de repostajes** con los tréboles ganados este mes, este año y en total, gráfico por meses y exportación a CSV (Excel).
- **¿Te llegaron los tréboles?**: a los 10 días de cada repostaje la app te pregunta. Si no llegaron, te dice hasta qué día puedes reclamarlos (30 días) y qué datos pide Club MAPFRE.
- Todo se guarda en tu dispositivo; no hay cuentas ni se envía nada a terceros.

**Técnicas**
- PWA: se instala en la pantalla de inicio y funciona sin conexión con los últimos datos vistos. Al mantener pulsado el icono hay accesos directos («Carnet», «Cerca», «Repostaje», «Ruta»), y la app avisa cuando hay una versión nueva.
- **Instalar la app**: botón «Instalar» en Android y aviso con los pasos en iPhone (Safari no deja instalar desde un botón). También en Ajustes.
- Si el servidor está arrancando (Render gratuito se duerme), la app espera y reintenta sola.
- Leyenda del mapa: colores por precio y borde amarillo para las de la lista oficial. En modo oscuro el mapa se oscurece.
- Modo oscuro automático.
- Servidor sin dependencias (solo Node.js): descarga los precios del Ministerio cada 30 minutos y los guarda en caché.

## Puesta en marcha

Solo hace falta [Node.js](https://nodejs.org) 20 o superior.

```bash
git clone https://github.com/srchipiron/gasolineras-mapfre.git
cd gasolineras-mapfre
npm start          # datos reales del Ministerio
# o
npm run demo       # datos inventados, para probar sin conexión
```

Abre <http://localhost:3000>. La primera descarga de precios tarda unos segundos, porque son unas 12.000 gasolineras. Después se guarda en `data/` y se refresca sola cada 30 minutos.

```bash
npm test           # 73 tests
```

## Usarla en el móvil

El navegador **solo da tu ubicación GPS en webs con HTTPS** (o en `localhost`). Tienes tres opciones:

1. **Publicarla en un servicio gratuito con HTTPS** (Render, Railway, Fly.io…). Ejemplo con Render: *New → Web Service*, conecta el repositorio, pon *Build command* `npm install` y *Start command* `npm start`. Después, en el móvil, abre la URL y elige «Añadir a pantalla de inicio».
2. **Docker** en tu servidor o NAS:
   ```bash
   docker build -t treboles .
   docker run -d -p 3000:3000 -v treboles-data:/data --name treboles treboles
   ```
3. **En tu red local**: `npm start` y abre en el móvil la dirección `http://192.168.x.x:3000` que aparece en la consola. Funciona todo salvo el GPS; busca por dirección.

## Configuración

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `HOST` | `0.0.0.0` | Interfaz donde escucha |
| `DEMO` | — | `1` para usar datos inventados |
| `REFRESH_MINUTES` | `30` | Cada cuánto se descargan precios nuevos |
| `DATA_DIR` | `./data` | Caché de precios e histórico |
| `MINETUR_BASE_URL` | API oficial | URL base de la API del Ministerio |
| `NOMINATIM_URL` | `https://nominatim.openstreetmap.org` | Buscador de direcciones |
| `OSRM_URL` | `https://router.project-osrm.org` | Cálculo de rutas |
| `LOG_REQUESTS` | — | `1` para registrar cada petición |

## Cómo se calculan los tréboles

Condiciones publicadas por Club MAPFRE para *Ahorro al Repostar* (consultadas el 18/11/2026, válidas hasta el 31/12/2026):

- **6 %** del repostaje en tréboles del día 1 al 5 de cada mes y **3 %** el resto. **1 trébol = 1 €** de descuento en tu seguro MAPFRE.
- **Tope**: compra máxima de 100 € al día o 300 € en la misma semana.
- **Excluidos**: GLP y GNC, y vehículos de más de 3.500 kg de uso no particular.
- Hay que **enseñar el carnet de socio al pagar en caja**: solo vale en estaciones adheridas con personal de atención.
- No acumulable con otros descuentos de la estación (MundoGalp, Waylet, Club Moeve gow…).

`precio efectivo = precio surtidor × (1 − % tréboles × valor del trébol)`, aplicando el tope de 100 € si el repostaje es mayor.

Por ejemplo, el día 2 un diésel a 1,489 € sale a 1,489 × 0,94 = **1,400 €/L**. El registro de repostajes aplica también el tope diario y semanal.

## Qué gasolineras cuentan como adheridas

**Solo las de la lista oficial del mapa de Club MAPFRE** («Más EESS colaboradoras» y «Gasolinera Repsol») (<https://www.mapfretecuidamos.com/gasolineras/>), importada desde un HAR o una respuesta del localizador, **y las que marques tú** (con «Marcar como adherida», el modo marcar o «✓ Me dieron tréboles»). Nada se deduce por la marca ni de otras webs.

Junto a los filtros hay un selector como el del mapa oficial: «Todas las adheridas», «Más EESS colaboradoras» o «Gasolinera Repsol».

**¿Merecen la pena los tréboles?** La app compara siempre la mejor gasolinera del filtro elegido con la mejor de fuera del filtro (por ejemplo, una low cost), por **coste real**: tus litros al precio con tréboles más el combustible de ir y volver. Te dice si ahorras o pierdes, y cuánto, aunque la lista solo muestre las del filtro.

Por defecto la app muestra solo esas gasolineras («Solo Club MAPFRE» activado). Mientras no importes la lista, te lo indica y te ofrece importarla o ver todas las gasolineras.

Si el mapa oficial indica un porcentaje para una estación (campo «ventajas»), la app usa ese porcentaje y muestra el texto en la ficha. Si no, aplica las condiciones del carnet: 6 % del día 1 al 5 y 3 % el resto, con el tope de 100 €/día y 300 €/semana.

### Importar la lista del mapa oficial

Desde un ordenador con Chrome o Edge:

1. Abre el mapa oficial y pulsa **F12** → pestaña **Red** (Network).
2. Busca en el mapa las ciudades de la zona, una a una. Cada búsqueda descarga las gasolineras de alrededor.
3. En la pestaña Red, clic derecho sobre cualquier petición → **Guardar todo como HAR**.
4. En la app: **Ajustes → Importar del mapa oficial**, elige el fichero y pulsa «Leer y emparejar».
5. Revisa el resultado por provincia, marca las que estén completas y pulsa «Guardar».

El HAR se lee en el navegador. Al servidor solo llegan los nombres y las posiciones de las gasolineras, nunca las cookies ni las cabeceras. Cada gasolinera del mapa oficial se empareja con la del Ministerio solo si es seguro: misma calle y número (hasta 600 m), misma calle (hasta 250 m), mismo nombre (hasta 400 m) o mismas coordenadas (menos de 30 m). Lo que no case queda «sin emparejar» para revisarlo a mano; nunca se atribuye a la gasolinera de al lado. El resultado de la importación muestra cada pareja.

Lo importado se guarda en ese navegador. Para verlo en todos tus dispositivos, pulsa **Descargar lista (adheridas.json)** y súbela al repositorio:

```bash
node scripts/importar-adheridas.mjs adheridas.json          # lista exportada desde la app
node scripts/importar-adheridas.mjs --provincias 41,29 mapa.har   # o directamente un HAR
```

El script actualiza `config/adheridas.json`. El servidor lo relee solo, sin reiniciar, y se publica con el siguiente despliegue.

## Estructura

```
gasolineras-mapfre/
├── server/            servidor HTTP sin dependencias
│   ├── index.js       arranque y configuración
│   ├── app.js         API JSON + ficheros estáticos (CSP, gzip, anti path traversal)
│   ├── minetur.js     cliente y parser de la API del Ministerio
│   ├── store.js       caché en memoria y en disco con refresco periódico
│   ├── search.js      búsqueda por radio y por corredor de ruta
│   ├── services.js    direcciones (Nominatim), rutas (OSRM) e histórico
│   ├── adheridas.js   lista compartida y emparejado con el mapa oficial
│   ├── tendencia.js   precio medio diario por provincia (últimos 14 días)
│   └── demo.js        datos de demostración con el formato real de la API
├── shared/            lógica común a servidor y navegador
│   ├── treboles.js    reglas de Club MAPFRE y cálculo de tréboles
│   ├── ranking.js     precio efectivo, coste real, filtros y estadísticas
│   ├── horario.js     interpreta horarios ("L-V: 06:00-22:00; S: ...")
│   ├── geo.js         distancias, rutas y simplificación de polilíneas
│   ├── locator.js     lee los datos del mapa oficial (JSON o HAR)
│   ├── provincias.js  códigos de provincia del INE
│   ├── vehiculos.js   perfiles de vehículo
│   ├── ics.js         recordatorio de calendario de los días del 6 %
│   └── fuels.js       carburantes del Ministerio
├── config/
│   └── adheridas.json lista compartida de gasolineras adheridas
├── scripts/
│   └── importar-adheridas.mjs  actualiza config/adheridas.json
├── public/            PWA (HTML, CSS y JS sin compilar; Leaflet, qrcode-generator y JsBarcode incluidos)
└── test/              tests con node:test
```

### API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/status` | Estado de los datos (fecha, nº de gasolineras, errores) |
| GET | `/api/fuels` | Carburantes disponibles |
| GET | `/api/program` | Reglas por defecto de Club MAPFRE |
| GET | `/api/stations?lat&lon&radius&fuel&public=1` | Gasolineras cercanas |
| GET | `/api/stations/:id` · `/api/stations/byIds?ids=a,b` | Gasolineras concretas |
| GET | `/api/route?from=lat,lon&to=lat,lon&corridor=2&fuel` | Ruta y gasolineras del trayecto |
| GET | `/api/geocode?q=` | Buscar una dirección (solo España) |
| GET | `/api/history/:id?days=30` | Histórico de precios |
| GET | `/api/trend?province=41&fuel=gasoleoA` | Precio medio de la provincia (o `ES`) en los últimos 14 días y su tendencia |
| GET | `/api/adheridas` | Lista compartida de gasolineras adheridas |
| POST | `/api/adheridas/match` | Empareja gasolineras del mapa oficial (`{ entries: [...] }`) con las del Ministerio |

## Problemas conocidos

- **Error de certificado al descargar del Ministerio** (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`): si aparece, define `NODE_EXTRA_CA_CERTS` con el certificado intermedio del Ministerio y vuelve a arrancar.
- **Detrás de un proxy** (oficinas, algunos servidores): el `fetch` de Node no usa `HTTPS_PROXY` salvo que arranques con `NODE_USE_ENV_PROXY=1` (Node 22.21 o superior).
- **Datos del Ministerio con errores**: algunas gasolineras publican las coordenadas intercambiadas (se corrigen) o en (0, 0) (se descartan). Unas 500 publican solo «L: …» de horario; como no se sabe si es solo el lunes o toda la semana, se muestra como horario desconocido.
- **Precio medio de la provincia**: al arrancar, el servidor descarga uno a uno los 14 días anteriores (unos 12 MB y 20 s cada uno, con pausas) y guarda solo las medias en `data/tendencia.json`. En Render gratuito el disco se borra al dormirse, así que tras un arranque en frío el gráfico tarda unos minutos en completarse.
- **Histórico**: se construye con los datos diarios por municipio del Ministerio (`EstacionesTerrestresHist/FiltroMunicipio`). La primera vez tarda unos segundos; después se guarda en `data/historico/`.
- **Nominatim y OSRM** son servicios públicos gratuitos con uso razonable (la app limita a 1 búsqueda por segundo y guarda caché). Para mucho tráfico, configura servidores propios con `NOMINATIM_URL` y `OSRM_URL`.

## Fuentes de datos

- Precios: [Geoportal de Hidrocarburos — Ministerio para la Transición Ecológica y el Reto Demográfico](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help).
- Mapa: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), con [Leaflet](https://leafletjs.com) (BSD-2).
- Carnet: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) y [JsBarcode](https://github.com/lindell/JsBarcode) (MIT), incluidos en `public/vendor/`.
- Direcciones: Nominatim (OpenStreetMap). Rutas: OSRM.
