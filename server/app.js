// Servidor HTTP sin dependencias: API JSON + ficheros estáticos de la PWA.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { nearby, alongRoute } from './search.js';
import { DEFAULT_PROGRAM } from '../shared/treboles.js';
import { FUELS } from '../shared/fuels.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STATIC_DIRS = [
  { prefix: '/shared/', dir: join(ROOT, 'shared') },
  { prefix: '/', dir: join(ROOT, 'public') },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join('; ');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function num(v, name, { min = -Infinity, max = Infinity, def } = {}) {
  if (v == null || v === '') {
    if (def !== undefined) return def;
    throw new HttpError(400, `Falta el parámetro ${name}`);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `Parámetro ${name} no válido`);
  return n;
}

function latLon(v, name) {
  const parts = String(v ?? '').split(',');
  if (parts.length !== 2) throw new HttpError(400, `Parámetro ${name} no válido (usa lat,lon)`);
  return { lat: num(parts[0], `${name}.lat`, { min: -90, max: 90 }), lon: num(parts[1], `${name}.lon`, { min: -180, max: 180 }) };
}

function fuelParam(v) {
  if (!v) return undefined;
  if (!/^[A-Za-z0-9]{1,40}$/.test(v)) throw new HttpError(400, 'Carburante no válido');
  return v;
}

function send(req, res, status, body, headers = {}) {
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const h = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    ...headers,
  };
  if (!h['Content-Type']) h['Content-Type'] = MIME['.json'];
  const compressible = /json|text|javascript|svg|manifest/.test(h['Content-Type']);
  if (compressible && buf.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    buf = gzipSync(buf);
    h['Content-Encoding'] = 'gzip';
    h['Vary'] = 'Accept-Encoding';
  }
  h['Content-Length'] = buf.length;
  res.writeHead(status, h);
  res.end(req.method === 'HEAD' ? undefined : buf);
}

/**
 * @param {object} deps
 * @param {import('./store.js').StationStore} deps.store
 * @param {{search(q:string):Promise<object[]>}} deps.geocoder
 * @param {{route(a:object,b:object):Promise<object>}} deps.router
 * @param {{forStation(st:object, days:number):Promise<object>}} deps.history
 */
export function createApp({ store, geocoder, router, history, demo = false, logger = console }) {
  function requireData() {
    if (!store.ready) {
      throw new HttpError(503, store.lastError ? `Sin datos de precios: ${store.lastError.message}` : 'Cargando precios, inténtalo en unos segundos');
    }
  }

  const routes = {
    'GET /api/status': () => ({ ...store.status(), demo }),

    'GET /api/program': () => DEFAULT_PROGRAM,

    'GET /api/fuels': () => {
      const counts = store.fuelCounts();
      return FUELS.filter((f) => counts[f.key]).map((f) => ({ ...f, count: counts[f.key] }));
    },

    'GET /api/stations': (q) => {
      requireData();
      const lat = num(q.get('lat'), 'lat', { min: -90, max: 90 });
      const lon = num(q.get('lon'), 'lon', { min: -180, max: 180 });
      const radiusKm = num(q.get('radius'), 'radius', { min: 0.1, max: 100, def: 10 });
      const limit = num(q.get('limit'), 'limit', { min: 1, max: 2000, def: 400 });
      const stations = nearby(store.stations, {
        lat, lon, radiusKm, limit,
        fuel: fuelParam(q.get('fuel')),
        publicOnly: q.get('public') === '1',
      });
      return { fecha: store.fecha, updatedAt: store.updatedAt, center: { lat, lon }, radiusKm, stations };
    },

    'GET /api/stations/byIds': (q) => {
      requireData();
      const ids = String(q.get('ids') ?? '').split(',').filter(Boolean).slice(0, 200);
      return { fecha: store.fecha, stations: ids.map((id) => store.byId.get(id)).filter(Boolean) };
    },

    'GET /api/route': async (q) => {
      requireData();
      const from = latLon(q.get('from'), 'from');
      const to = latLon(q.get('to'), 'to');
      const corridorKm = num(q.get('corridor'), 'corridor', { min: 0.2, max: 20, def: 2 });
      let route;
      try {
        route = await router.route(from, to);
      } catch (err) {
        throw new HttpError(502, `No se pudo calcular la ruta: ${err.message}`);
      }
      const stations = alongRoute(store.stations, route.polyline, {
        corridorKm,
        fuel: fuelParam(q.get('fuel')),
        publicOnly: q.get('public') === '1',
      });
      return { fecha: store.fecha, route, corridorKm, stations };
    },

    'GET /api/geocode': async (q) => {
      const text = String(q.get('q') ?? '').trim();
      if (text.length < 2 || text.length > 200) throw new HttpError(400, 'Escribe al menos 2 caracteres');
      try {
        return { results: await geocoder.search(text) };
      } catch (err) {
        throw new HttpError(502, `No se pudo buscar la dirección: ${err.message}`);
      }
    },
  };

  async function handleApi(req, url) {
    const key = `${req.method === 'HEAD' ? 'GET' : req.method} ${url.pathname}`;
    if (routes[key]) return routes[key](url.searchParams);

    let m = /^\/api\/stations\/([A-Za-z0-9]+)$/.exec(url.pathname);
    if (m && (req.method === 'GET' || req.method === 'HEAD')) {
      requireData();
      const st = store.byId.get(m[1]);
      if (!st) throw new HttpError(404, 'Estación no encontrada');
      return { fecha: store.fecha, station: st };
    }
    m = /^\/api\/history\/([A-Za-z0-9]+)$/.exec(url.pathname);
    if (m && (req.method === 'GET' || req.method === 'HEAD')) {
      requireData();
      const st = store.byId.get(m[1]);
      if (!st) throw new HttpError(404, 'Estación no encontrada');
      const days = num(url.searchParams.get('days'), 'days', { min: 1, max: 90, def: 30 });
      return { stationId: st.id, ...(await history.forStation(st, days)) };
    }
    throw new HttpError(404, 'Ruta de API desconocida');
  }

  async function serveStatic(req, res, url) {
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      throw new HttpError(400, 'Ruta no válida');
    }
    if (pathname.includes('\0')) throw new HttpError(400, 'Ruta no válida');
    for (const { prefix, dir } of STATIC_DIRS) {
      if (!pathname.startsWith(prefix)) continue;
      let rel = pathname.slice(prefix.length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const file = normalize(join(dir, rel));
      if (!file.startsWith(dir + sep)) throw new HttpError(403, 'Prohibido');
      try {
        const s = await stat(file);
        if (!s.isFile()) continue;
        const body = await readFile(file);
        const ext = extname(file);
        const headers = {
          'Content-Type': MIME[ext] ?? 'application/octet-stream',
          'Cache-Control': ext === '.html' || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=3600',
        };
        if (ext === '.html') {
          headers['Content-Security-Policy'] = CSP;
          headers['X-Frame-Options'] = 'DENY';
        }
        return send(req, res, 200, body, headers);
      } catch (err) {
        if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
      }
    }
    throw new HttpError(404, 'No encontrado');
  }

  return async function handler(req, res) {
    const t0 = Date.now();
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const data = await handleApi(req, url);
        send(req, res, 200, data, { 'Cache-Control': 'no-cache' });
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        await serveStatic(req, res, url);
      } else {
        throw new HttpError(405, 'Método no permitido');
      }
    } catch (err) {
      const status = err.status ?? 500;
      if (status >= 500) logger.error?.(`${req.method} ${url.pathname} -> ${status}: ${err.message}`);
      const body = url.pathname.startsWith('/api/') ? { error: err.message } : `${status} ${err.message}`;
      if (!res.headersSent) {
        send(req, res, status, body, url.pathname.startsWith('/api/') ? {} : { 'Content-Type': MIME['.txt'] });
      } else {
        res.end();
      }
    } finally {
      if (process.env.LOG_REQUESTS === '1') logger.info?.(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - t0}ms`);
    }
  };
}

export function createHttpServer(deps) {
  return createServer(createApp(deps));
}
