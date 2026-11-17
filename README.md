# Repostar con Tréboles 🍀⛽

Aplicación web (instalable en el móvil) para encontrar la **gasolinera más barata de España teniendo en cuenta los tréboles de Club MAPFRE**.

No basta con mirar el precio del surtidor: en las gasolineras adheridas al programa *Ahorro al Repostar* te devuelven un porcentaje en tréboles, así que la app calcula el **precio efectivo** (lo que de verdad te cuesta cada litro) y te dice si compensa ir a una gasolinera de Club MAPFRE o a una *low cost* que no lo es.

> App no oficial, sin relación con MAPFRE. Los precios vienen del Ministerio para la Transición Ecológica. Comprueba siempre las condiciones y las estaciones adheridas en la web o la app de Club MAPFRE.

## Funcionalidades

**Búsqueda**
- Gasolineras cerca de tu ubicación (GPS) o de una dirección, ciudad o código postal.
- Todos los carburantes del Ministerio: diésel, gasolina 95/98, premium, GLP, GNC, GNL, AdBlue, hidrógeno…
- Radio de búsqueda de 2 a 50 km.
- Filtros: solo Club MAPFRE, abiertas ahora y ocultar las de venta restringida (cooperativas y flotas).
- Cuatro órdenes: precio con tréboles, precio en surtidor, **coste real** (incluye la gasolina que gastas en ir y volver) y distancia.

**Club MAPFRE**
- Precio efectivo por litro con el porcentaje de tréboles del día: **6 % del día 1 al 5** de cada mes y **3 % el resto**.
- Comparativa directa entre la mejor de Club MAPFRE y la más barata sin tréboles, con la diferencia en €/L y en € por depósito.
- Aviso de cuándo es día de 6 % y cuántos días faltan para el siguiente.
- Reglas configurables: marcas que cuentan, porcentajes, días bonificados y valor del trébol.
- Puedes marcar cualquier gasolinera a mano como adherida o no adherida.

**Mapa y ficha**
- Mapa con precios de colores (verde barata, ámbar media, rojo cara) y la mejor opción destacada.
- Ficha de cada gasolinera: horario y si está abierta, todos los precios con y sin tréboles, y gráfico de los últimos 30 días.
- Botones para ir con Google Maps, Waze o Apple Maps, y para compartir.

**Ruta**
- Gasolineras a lo largo de un viaje (p. ej. Madrid → Valencia), con desvío máximo de 1 a 10 km.
- Ordenadas por precio con tréboles, por coste real o por el orden en que te las encuentras.

**Lo tuyo**
- Favoritas con **aviso de precio objetivo**: al abrir la app te avisa si alguna ha bajado de tu precio.
- **Registro de repostajes** con los tréboles ganados este mes, este año y en total, y exportación a CSV (Excel).
- Todo se guarda en tu dispositivo; no hay cuentas ni se envía nada a terceros.

**Técnicas**
- PWA: se instala en la pantalla de inicio y funciona sin conexión con los últimos datos vistos.
- Modo oscuro automático.
- Servidor sin dependencias (solo Node.js): descarga los precios del Ministerio cada 30 minutos y los guarda en caché.

## Puesta en marcha

Solo hace falta [Node.js](https://nodejs.org) 20 o superior.

```bash
cd gasolineras-mapfre
npm start          # datos reales del Ministerio
# o
npm run demo       # datos inventados, para probar sin conexión
```

Abre <http://localhost:3000>. La primera descarga de precios tarda unos segundos, porque son unas 12.000 gasolineras. Después se guarda en `data/` y se refresca sola cada 30 minutos.

```bash
npm test           # 37 tests
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

Condiciones publicadas por Club MAPFRE para *Ahorro al Repostar* (consultadas en noviembre de 2026, válidas hasta el 31/12/2026):

- **6 %** del importe en tréboles del día 1 al 5 de cada mes y **3 %** el resto.
- **1 trébol = 1 €** de descuento en tu seguro MAPFRE.
- No es acumulable con otros descuentos de la estación (MundoGalp, Waylet…).

`precio efectivo = precio surtidor × (1 − % tréboles × valor del trébol)`

Por ejemplo, el día 2 un diésel a 1,489 € en una Galp sale a 1,489 × 0,94 = **1,400 €/L**.

**Qué gasolineras cuentan.** La lista exacta de estaciones adheridas solo está en el localizador de Club MAPFRE (unas 1.500), así que la app trabaja por marcas:

| Regla | Por defecto | Notas |
|---|---|---|
| Galp | activada | Identifícate con el carnet o la app de Club MAPFRE |
| Repsol | desactivada | Solo si pagas con la Tarjeta Repsol Carburante |
| Moeve / Cepsa | desactivada | Solo algunas estaciones: márcalas a mano |

Todo se cambia en **Ajustes**: porcentajes, días, marcas o reglas nuevas. Si una gasolinera concreta está o no adherida, ábrela y pulsa «Marcar como adherida» o «Marcar como NO adherida». Si no vas a poder gastar los tréboles (por ejemplo, porque tus seguros ya están pagados), baja el valor del trébol.

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
│   └── demo.js        datos de demostración con el formato real de la API
├── shared/            lógica común a servidor y navegador
│   ├── treboles.js    reglas de Club MAPFRE y cálculo de tréboles
│   ├── ranking.js     precio efectivo, coste real, filtros y estadísticas
│   ├── horario.js     interpreta horarios ("L-V: 06:00-22:00; S: ...")
│   ├── geo.js         distancias, rutas y simplificación de polilíneas
│   └── fuels.js       carburantes del Ministerio
├── public/            PWA (HTML, CSS y JS sin compilar; Leaflet incluido)
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

## Problemas conocidos

- **Error de certificado al descargar del Ministerio** (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`): el servidor del Ministerio a veces no envía el certificado intermedio. Arranca con `NODE_OPTIONS=--use-system-ca npm start` (Node 22.15 o superior) o define `NODE_EXTRA_CA_CERTS` con ese certificado.
- **Histórico**: se construye con los datos diarios por municipio del Ministerio (`EstacionesTerrestresHist/FiltroMunicipio`). La primera vez tarda unos segundos; después se guarda en `data/historico/`.
- **Nominatim y OSRM** son servicios públicos gratuitos con uso razonable (la app limita a 1 búsqueda por segundo y guarda caché). Para mucho tráfico, configura servidores propios con `NOMINATIM_URL` y `OSRM_URL`.
- La CI (`.github/workflows/ci.yml`) funciona cuando esta carpeta es la raíz de su propio repositorio.

## Fuentes de datos

- Precios: [Geoportal de Hidrocarburos — Ministerio para la Transición Ecológica y el Reto Demográfico](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help).
- Mapa: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), con [Leaflet](https://leafletjs.com) (BSD-2).
- Direcciones: Nominatim (OpenStreetMap). Rutas: OSRM.
