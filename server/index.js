#!/usr/bin/env node
// Punto de entrada: `npm start` (datos reales) o `npm run demo` (datos inventados).

import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { createHttpServer } from './app.js';
import { StationStore } from './store.js';
import { createMineturClient, DEFAULT_BASE_URL } from './minetur.js';
import { createGeocoder, createRouter, createHistory } from './services.js';
import { generateDemoResponse, generateDemoPrevResponse, generateDemoDayResponse, createDemoGeocoder, createDemoRouter, createDemoHistory } from './demo.js';
import { createOfficialSource } from './adheridas.js';
import { TrendStore } from './tendencia.js';

const env = process.env;
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA_DIR = env.DATA_DIR ?? join(ROOT, 'data');
const demo = env.DEMO === '1' || process.argv.includes('--demo');
const OFFICIAL_FILE = env.ADHERIDAS_FILE ?? join(ROOT, 'config', 'adheridas.json');
const port = Number(env.PORT ?? 3000);
const host = env.HOST ?? '0.0.0.0';
const logger = {
  info: (m) => console.log(`[${new Date().toISOString()}] ${m}`),
  warn: (m) => console.warn(`[${new Date().toISOString()}] AVISO ${m}`),
  error: (m) => console.error(`[${new Date().toISOString()}] ERROR ${m}`),
};

const client = createMineturClient({ baseUrl: env.MINETUR_BASE_URL ?? DEFAULT_BASE_URL });

// Precio medio por provincia de los últimos 14 días (tendencia).
const trend = new TrendStore({
  loadDay: demo ? async (date) => generateDemoDayResponse(date) : (date) => client.fetchHistAll(date),
  cacheFile: demo ? null : join(DATA_DIR, 'tendencia.json'),
  delayMs: demo ? 0 : 20_000,
  logger,
});

const store = new StationStore({
  onPrev: demo ? null : (date, stations) => trend.addDay(date, stations),
  load: demo ? async () => generateDemoResponse() : () => client.fetchAll(),
  loadPrev: demo ? async () => generateDemoPrevResponse() : (date) => client.fetchHistAll(date),
  cacheFile: demo ? null : join(DATA_DIR, 'estaciones.json'),
  prevCacheFile: demo ? null : (date) => join(DATA_DIR, `precios-${date}.json`),
  refreshMs: Number(env.REFRESH_MINUTES ?? 30) * 60 * 1000,
  source: demo ? 'demo' : 'minetur',
  logger,
});

const deps = {
  store,
  trend,
  demo,
  logger,
  geocoder: demo ? createDemoGeocoder() : createGeocoder({ baseUrl: env.NOMINATIM_URL }),
  router: demo ? createDemoRouter() : createRouter({ baseUrl: env.OSRM_URL }),
  history: demo ? createDemoHistory() : createHistory({ client, cacheDir: join(DATA_DIR, 'historico'), logger }),
  // Lista compartida de gasolineras adheridas (se versiona en el repositorio).
  official: createOfficialSource(OFFICIAL_FILE),
  // Publicar la lista para todos desde la app (Ajustes). Sin ADMIN_KEY no se puede.
  publish: env.ADMIN_KEY
    ? {
      adminKey: env.ADMIN_KEY,
      officialFile: OFFICIAL_FILE,
      github: env.GITHUB_TOKEN ? { token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO ?? 'srchipiron/gasolineras-mapfre', branch: env.GITHUB_BRANCH ?? 'main' } : null,
    }
    : null,
};

const server = createHttpServer(deps);
server.listen(port, host, () => {
  logger.info(`Gasolineras Club MAPFRE ${demo ? '(MODO DEMO, precios inventados) ' : ''}en http://localhost:${port}`);
  if (host === '0.0.0.0') {
    for (const addrs of Object.values(networkInterfaces())) {
      for (const a of addrs ?? []) {
        if (a.family === 'IPv4' && !a.internal) logger.info(`  En tu red local: http://${a.address}:${port}`);
      }
    }
  }
});

store.init().catch((err) => logger.error(err.message));
trend.init({ startDelayMs: demo ? 1000 : 90_000 }).catch((err) => logger.error(err.message));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    store.stop();
    trend.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
