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
- **La más barata de cada marca**: tarjeta con la gasolinera más barata de cada cadena de la zona (o de la ruta), cuántas hay y a qué distancia, para comparar de un vistazo Alcampo, Petroprix, Plenergy o las adheridas 🍀.
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
- **«Te quedan (L)»**: con los litros que te quedan y el consumo del vehículo, hasta qué km llegas (con un 15 % de margen); «Te aconsejo» elige la mejor gasolinera antes de ese punto.

**Lo tuyo**
- **«Te aconsejo»**: arriba del todo (cerca y en la ruta), una sola gasolinera, la mejor para ti según el modo, con el porqué y «Cómo llegar». En tu coche, la que menos te cuesta de verdad: los tréboles cuentan (ya descontados, con el tope), pero si una sin tréboles sale más barata, gana ella, y la tarjeta dice cuánto ahorras frente a la mejor con (o sin) tréboles. En el de empresa, la que más tréboles te da. Busca entre todas las abiertas, aunque tengas «Solo Club MAPFRE», y se destaca en el mapa. La lista se ordena igual por defecto («Lo mejor para ti»).
- **Dos modos: «Voy en mi coche» y «Voy en el coche de empresa»**, arriba del todo. En tu coche pagas tú y manda el precio con tréboles. En el de empresa el carburante no sale de tu bolsillo pero los tréboles van a tu carnet: la lista pone primero las que más tréboles te dan (entre iguales, la que menos le cuesta a la empresa), enseña «+X 🍀» en cada gasolinera y cuánto paga de más la empresa frente a la más barata. Cada modo recuerda su vehículo y su orden. El tope de 100 €/300 € es de tu carnet y cuenta en los dos.
- En cada repostaje, **«Pago yo» o «Paga la empresa»**: el registro separa lo que salió de tu bolsillo y lo que pagó la empresa (también en el CSV); los tréboles son tuyos en los dos casos.
- **Novedades y versión** al final de Ajustes: el registro de cambios, la versión de la app instalada y la publicada en el servidor, y aviso si no coinciden.
- **Gasto del viaje** en el modo ruta: litros y euros del trayecto con el consumo de tu vehículo, al precio de la mejor gasolinera de la ruta y a precio medio, e ida y vuelta.
- **Mi carnet**: guarda tu número de socio de Club MAPFRE y enséñalo en caja a pantalla completa con QR, código de barras (Code 128, o EAN-13 si tu número lo es) y el número en grande. La pantalla no se apaga mientras está abierto. Botón «🪪 Mi carnet» arriba, en la ficha de cada adherida y como acceso directo del icono.
- Favoritas con **aviso de precio objetivo**: al abrir la app te avisa si alguna ha bajado de tu precio.
- **Registro de repostajes** con los tréboles ganados este mes, este año y en total, gráfico por meses y exportación a CSV (Excel).
- **¿Te llegaron los tréboles?**: a los 10 días de cada repostaje la app te pregunta. Si no llegaron, te dice hasta qué día puedes reclamarlos (30 días) y qué datos pide Club MAPFRE.
- Todo se guarda en tu dispositivo; no hay cuentas ni se envía nada a terceros.
- **Copia de seguridad** (Ajustes): guarda en un fichero tu lista oficial importada, favoritas, repostajes, carnet, vehículos y ajustes, y cárgala en otro móvil, otro navegador o la app instalada (en iPhone la app de la pantalla de inicio no comparte datos con Safari). En el móvil se comparte por WhatsApp, correo o Archivos.

**Técnicas**
- PWA: se instala en la pantalla de inicio y funciona sin conexión con los últimos datos vistos. Al mantener pulsado el icono hay accesos directos («Carnet», «Cerca», «Repostaje», «Ruta»), y la app avisa cuando hay una versión nueva.
- **Instalar la app**: botón «Instalar» en Android y aviso con los pasos en iPhone (Safari no deja instalar desde un botón). También en Ajustes.
- **A simple vista**, bajo los filtros: hace cuánto son los precios («⏱ Precios: hace 12 min») y de cuándo es la lista de adheridas; en ámbar si los precios tienen más de 3 horas.
- **🔄 Actualizar**: vuelve a descargar los precios, la lista compartida y el estado del servidor, y busca si hay versión nueva de la app. Si el servidor está despertando, la app reintenta sola (hasta unos 4 minutos) aunque falle la conexión.
- **Al momento al abrir**: la app enseña la última lista guardada en el móvil para esa búsqueda, con la hora de esos precios, mientras el servidor responde. Si Render gratuito está dormido, se actualiza sola en cuanto despierta (sin esperar en blanco).
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
| `ADHERIDAS_FILE` | `config/adheridas.json` | Lista de adheridas para todos |
| `ADMIN_KEY` | — | Clave para «Publicar para todos» desde Ajustes. Sin ella no se puede publicar |
| `GITHUB_TOKEN` | — | Token de GitHub con permiso de escritura en *Contents* del repositorio: la lista publicada se guarda en `config/adheridas.json` del repositorio y sobrevive a reinicios y despliegues |
| `GITHUB_REPO` / `GITHUB_BRANCH` | `srchipiron/gasolineras-mapfre` / `main` | Dónde se guarda la lista publicada |

### Lista de adheridas para todos los usuarios

La lista importada del mapa oficial se guarda en el dispositivo donde se importa. Para que la use la app en todos los móviles:

1. En Render, *Environment*, añade `ADMIN_KEY` (una contraseña larga que elijas) y `GITHUB_TOKEN`: en GitHub, *Settings → Developer settings → Fine-grained tokens → Generate new token*, solo el repositorio `gasolineras-mapfre`, permiso *Contents: Read and write*.
2. En el móvil donde importaste la lista: *Ajustes → Publicar para todos*, escribe la clave y pulsa «Publicar».
3. El servidor la guarda al momento y la sube al repositorio. Render despliega la versión nueva en unos minutos y desde entonces todos los móviles la reciben al abrir la app (o con 🔄 Actualizar).

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

### Actualizar la lista con un clic («Enviar a Tréboles»)

Desde un ordenador (Chrome, Edge o Firefox):

1. La primera vez: en **Ajustes → Actualizar la lista desde el mapa oficial**, arrastra el botón **🍀 Enviar a Tréboles** a la barra de marcadores (`Ctrl+Mayús+B` si no la ves).
2. Abre el mapa oficial y pulsa ese marcador. Sale un recuadro verde.
3. Busca cualquier ciudad en el buscador del mapa. El mapa descarga la lista de toda España, el recuadro dice cuántas ha leído y aparece «Enviar a Tréboles».
4. Al pulsarlo se abre la app con lo que cambia frente a tu lista: nuevas, las que ya no están y las que cambian de tipo. Pulsa «Guardar».

Cómo funciona (`shared/capturar.js`, `server/capturas.js`):
- **Qué lee:** el marcador solo lee la respuesta que el mapa ya ha recibido en tu navegador, igual que un HAR. No usa las credenciales de MAPFRE ni le hace peticiones por su cuenta.
- **Cómo llega a la app:** sube la lista a Tréboles, que solo acepta esa subida desde el origen del mapa oficial, y recibe un código de un solo uso. La app recoge la lista con ese código. Se guarda solo en memoria, 30 minutos como mucho.
- **Qué sustituye:** como es la lista de toda España, sustituye a la anterior en ese dispositivo, y las que MAPFRE quita dejan de dar tréboles. Si después se publica en el servidor una lista más nueva, manda la del servidor.
- **Otros móviles:** para que llegue a todos, usa «Publicar para todos» o «Descargar lista» (ver abajo).

### Importar la lista del mapa oficial (HAR)

La alternativa manual, desde un ordenador con Chrome o Edge:

1. Abre el mapa oficial y pulsa **F12** → pestaña **Red** (Network).
2. Busca cualquier ciudad en el mapa. Cada búsqueda descarga las gasolineras de toda España.
3. En la pestaña Red, clic derecho sobre cualquier petición → **Guardar todo como HAR**.
4. En la app: **Ajustes → Importar del mapa oficial (HAR o JSON)**, elige el fichero y pulsa «Leer y emparejar».
5. Revisa el resultado y pulsa «Guardar».

El HAR se lee en el navegador. Al servidor solo llegan los nombres y las posiciones de las gasolineras, nunca las cookies ni las cabeceras. Cada gasolinera del mapa oficial se empareja con la del Ministerio solo si es seguro: misma calle o carretera y número o punto kilométrico (hasta 600 m), misma calle o carretera (hasta 250 m), mismo nombre (hasta 400 m) o mismas coordenadas (menos de 30 m). Lo que no case queda «sin emparejar» para revisarlo a mano; nunca se atribuye a la gasolinera de al lado. El resultado de la importación muestra cada pareja.

Lo importado se guarda en ese navegador. Para verlo en todos tus dispositivos, pulsa **Descargar lista (adheridas.json)** y súbela al repositorio:

```bash
node scripts/importar-adheridas.mjs adheridas.json          # lista exportada desde la app
node scripts/importar-adheridas.mjs --provincias 41,29 mapa.har   # o directamente un HAR
```

El script actualiza `config/adheridas.json`. El servidor lo relee solo, sin reiniciar, y se publica con el siguiente despliegue.

### Revisar la lista sin volver a importar

Una «Gasolinera Repsol» del mapa oficial nunca se empareja con una gasolinera de otra cadena (Plenergy, Petroprix, Ballenoil, Cepsa…): suele ser una Repsol que cambió de rótulo o la de al lado en la misma avenida. Los rótulos con el nombre del dueño y Petrocat (vinculada a Repsol) sí se aceptan. Para revisar la lista ya importada con las estaciones actuales del Ministerio:

```
node scripts/revisar-adheridas.mjs --simular   # enseña qué cambiaría
node scripts/revisar-adheridas.mjs             # lo guarda en config/adheridas.json
```

Las que se pueden pasar a la Repsol de verdad (cerca y en la misma calle) se pasan; el resto se quitan.

**El servidor lo hace solo**: con cada descarga de precios del Ministerio (cada 30 min) revisa la lista que sirve a la app, sin tocar `config/adheridas.json`. En Ajustes se ve qué ha cambiado y, si la lista del mapa oficial tiene más de 2 meses, un aviso aquí y en la línea «🍀 Adheridas» (en ámbar, con un enlace para actualizarla). El servidor no descarga solo la lista del mapa oficial: su servicio está protegido con credenciales de MAPFRE y no hay permiso para usarlo desde otra web. Por eso la actualización se hace con «Enviar a Tréboles» desde tu navegador.

### La lista va empaquetada con la app

El localizador devuelve **todas las adheridas de España en cada búsqueda**, así que un solo HAR basta para toda la lista:

```bash
node scripts/importar-adheridas.mjs --reemplazar --toda-espana mapa-oficial.har
```

Del HAR (decenas de MB, la misma respuesta repetida en cada búsqueda) solo se guarda lo que usa la app: por cada gasolinera del Ministerio, su tipo, el nombre y las ventajas. Queda en unos 600 KB de JSON, y unos 45 KB comprimido con gzip al descargarlo. El servidor lo sirve también como `/data/adheridas.json`. El service worker lo guarda al instalar la app, de modo que el móvil lo tiene al abrirla, sin conexión y sin esperar a que despierte el servidor. Después busca en segundo plano la lista publicada más reciente. Ya no hace falta pasar el HAR al móvil.

## Versiones y registro de cambios

El registro de cambios está en `shared/changelog.js` (la primera entrada es la versión actual). Al publicar algo nuevo, añade una entrada arriba y sube la versión también en `package.json` (un test comprueba que coinciden) y `VERSION` en `public/sw.js`.

La app enseña al final de Ajustes su versión (la del código guardado en el móvil) y la del servidor (`version` en `/api/status`, la que corre en treboles.onrender.com). Si la publicada es más nueva, basta con 🔄 Actualizar o volver a abrir la app.

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
│   ├── capturas.js    listas subidas por «Enviar a Tréboles» (en memoria, un solo uso)
│   ├── tendencia.js   precio medio diario por provincia (últimos 14 días)
│   └── demo.js        datos de demostración con el formato real de la API
├── shared/            lógica común a servidor y navegador
│   ├── treboles.js    reglas de Club MAPFRE y cálculo de tréboles
│   ├── ranking.js     precio efectivo, coste real, filtros y estadísticas
│   ├── horario.js     interpreta horarios ("L-V: 06:00-22:00; S: ...")
│   ├── geo.js         distancias, rutas y simplificación de polilíneas
│   ├── capturar.js    marcador «Enviar a Tréboles» para el mapa oficial
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
| POST | `/api/adheridas/publish` | Publica la lista para todos (`{ key, list }`, necesita `ADMIN_KEY`) |
| POST | `/api/adheridas/match` | Empareja gasolineras del mapa oficial (`{ entries: [...] }`) con las del Ministerio |

## Problemas conocidos

- **Error de certificado al descargar del Ministerio** (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`): si aparece, define `NODE_EXTRA_CA_CERTS` con el certificado intermedio del Ministerio y vuelve a arrancar.
- **Detrás de un proxy** (oficinas, algunos servidores): el `fetch` de Node no usa `HTTPS_PROXY` salvo que arranques con `NODE_USE_ENV_PROXY=1` (Node 22.21 o superior).
- **Datos del Ministerio con errores**: algunas gasolineras publican las coordenadas intercambiadas (se corrigen) o en (0, 0) (se descartan). Unas 500 publican solo «L: …» de horario; como no se sabe si es solo el lunes o toda la semana, se muestra como horario desconocido.
- **Precio medio de la provincia**: al arrancar, el servidor descarga uno a uno los 14 días anteriores (unos 12 MB y 20 s cada uno, con pausas) y guarda solo las medias en `data/tendencia.json`. En Render gratuito el disco se borra al dormirse, así que tras un arranque en frío el gráfico tarda unos minutos en completarse.
- **Histórico**: se construye con los datos diarios por municipio del Ministerio (`EstacionesTerrestresHist/FiltroMunicipio`). La primera vez tarda unos segundos; después se guarda en `data/historico/`.
- **Nominatim y OSRM** son servicios públicos gratuitos con uso razonable (la app limita a 1 búsqueda por segundo y guarda caché). Para mucho tráfico, configura servidores propios con `NOMINATIM_URL` y `OSRM_URL`.
- **Búsqueda de direcciones con error 429**: Nominatim limita las IP compartidas como la de Render gratuito. Por eso el móvil busca directamente en Nominatim con su propia IP. Si no puede, pregunta al servidor, que prueba Nominatim y, si responde 429 o falla, usa [Photon](https://photon.komoot.io) (también con datos de OpenStreetMap). Tras un 429, el servidor no vuelve a probar Nominatim durante un minuto.

## Fuentes de datos

- Precios: [Geoportal de Hidrocarburos — Ministerio para la Transición Ecológica y el Reto Demográfico](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help).
- Mapa: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), con [Leaflet](https://leafletjs.com) (BSD-2).
- Carnet: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) y [JsBarcode](https://github.com/lindell/JsBarcode) (MIT), incluidos en `public/vendor/`.
- Direcciones: Nominatim (OpenStreetMap). Rutas: OSRM.
