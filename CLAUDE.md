# Repostar con Tréboles (gasolineras-mapfre)

App web instalable (PWA) que busca la gasolinera más barata de España teniendo en cuenta los tréboles de Club MAPFRE (precio efectivo = precio de surtidor − tréboles). App no oficial. Precios del Ministerio (Minetur). Uso principal: el móvil de Javi, en coche y en moto.

## Tecnología

- Node.js ≥ 20, sin framework y sin dependencias (`"type": "module"`).
- `server/`: servidor HTTP (`index.js` arranca, `app.js` rutas, `minetur.js` descarga de precios, `store.js` caché en `data/`, `publish.js` sube la lista de adheridas al repo).
- `shared/`: lógica que usan servidor y cliente (tréboles, ranking, marcas, vehículos, horarios, rutas…).
- `public/`: la app (HTML/CSS/JS, service worker).
- `config/adheridas.json`: lista oficial de gasolineras adheridas. Solo cuenta como adherida lo que está en esa lista o lo que marca el usuario; nunca se deduce por la marca.
- `test/`: tests con `node --test`.

## Comandos

```
npm start      # datos reales, http://localhost:3000
npm run demo   # datos inventados, sin conexión
npm test       # todos los tests
```

## Despliegue

Render (plan gratuito) despliega solo cada push a `main`. Render gratuito se duerme: la app enseña la última lista guardada mientras despierta. CI (GitHub Actions) pasa `npm test` en Node 20 y 22 en cada push y PR.

## Forma de trabajar

1. Antes de construir, resume en 3-5 líneas qué has entendido. Si algo cambia lo que ve el usuario y se puede entender de dos formas, pregunta.
2. Una tarea por sesión. Lo que veas mejorable por el camino va al final como propuesta, sin construirlo.
3. `npm test` en verde antes de dar nada por hecho. Si una prueba falla, arregla la causa, no la prueba. Funciones nuevas con su test.
4. Mira la app en tamaño móvil antes de decir que está.
5. Al cerrar: sube la versión en `package.json` y añade la entrada en `shared/changelog.js`; actualiza el README si cambia una función visible.
6. Trabaja en una rama, abre PR a `main` y, al fusionar, borra la rama.
7. Termina con un resumen en lenguaje llano: qué hay nuevo, qué tiene que probar Javi en el móvil, qué has decidido sin preguntar y qué queda pendiente.

## Reglas

- No inventes porcentajes de tréboles: 6 % del día 1 al 5 de cada mes y 3 % el resto, salvo que Javi diga otra cosa.
- No pongas datos personales ni claves en el repo (es público). `ADMIN_KEY` y `GITHUB_TOKEN` van en las variables de entorno de Render.
