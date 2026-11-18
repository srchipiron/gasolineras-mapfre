// Almacén en memoria de las estaciones, con refresco periódico y copia en
// disco para arrancar sin conexión o si el Ministerio no responde.

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseResponse } from './minetur.js';

/** Fecha de hoy en España peninsular (aaaa-mm-dd), sea cual sea la zona del servidor. */
export function madridDate(now = new Date(), offsetDays = 0) {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export class StationStore {
  /**
   * @param {object} o
   * @param {() => Promise<object>} o.load devuelve la respuesta en bruto de la API
   * @param {string} [o.cacheFile] ruta del JSON cacheado en disco
   * @param {number} [o.refreshMs] cada cuánto refrescar (0 = nunca)
   * @param {string} [o.source] 'minetur' | 'demo'
   */
  constructor({ load, loadPrev = null, onPrev = null, cacheFile, prevCacheFile = null, refreshMs = 30 * 60 * 1000, source = 'minetur', logger = console }) {
    this.load = load;
    this.onPrev = onPrev; // (fecha, estaciones) cuando se descargan los precios de ayer
    this.loadPrev = loadPrev; // (Date) => respuesta en bruto de los precios de ese día
    this.prevCacheFile = prevCacheFile;
    this.prev = null; // { date, byId: Map(id -> prices) } con los precios de ayer
    this.loadingPrev = null;
    this.cacheFile = cacheFile;
    this.refreshMs = refreshMs;
    this.source = source;
    this.log = logger;
    this.stations = [];
    this.byId = new Map();
    this.fecha = null;
    this.updatedAt = null;
    this.fetchedAt = null;
    this.lastError = null;
    this.refreshing = null;
    this.timer = null;
  }

  get ready() {
    return this.stations.length > 0;
  }

  setData({ fecha, updatedAt, stations }, fetchedAt = new Date().toISOString()) {
    this.stations = stations;
    this.byId = new Map(stations.map((s) => [s.id, s]));
    this.fecha = fecha;
    this.updatedAt = updatedAt;
    this.fetchedAt = fetchedAt;
  }

  async loadCache() {
    if (!this.cacheFile) return false;
    try {
      const data = JSON.parse(await readFile(this.cacheFile, 'utf8'));
      if (Array.isArray(data.stations) && data.stations.length) {
        this.setData(data, data.fetchedAt);
        this.log.info?.(`Caché cargada: ${data.stations.length} estaciones (${data.fecha})`);
        return true;
      }
    } catch {
      /* sin caché */
    }
    return false;
  }

  async saveCache() {
    if (!this.cacheFile) return;
    await mkdir(dirname(this.cacheFile), { recursive: true });
    const tmp = `${this.cacheFile}.tmp`;
    await writeFile(
      tmp,
      JSON.stringify({ fecha: this.fecha, updatedAt: this.updatedAt, fetchedAt: this.fetchedAt, stations: this.stations }),
    );
    await rename(tmp, this.cacheFile);
  }

  /** Descarga los datos de nuevo (las llamadas simultáneas comparten petición). */
  refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const t0 = Date.now();
      try {
        const parsed = parseResponse(await this.load());
        if (!parsed.stations.length) throw new Error('La API no devolvió estaciones');
        this.setData(parsed);
        this.lastError = null;
        this.log.info?.(`Precios actualizados: ${parsed.stations.length} estaciones (${parsed.fecha}) en ${Date.now() - t0} ms`);
        await this.saveCache().catch((e) => this.log.warn?.(`No se pudo guardar la caché: ${e.message}`));
        this.ensurePrev().catch(() => {});
      } catch (err) {
        this.lastError = { message: err.message, at: new Date().toISOString() };
        this.log.error?.(`Error al actualizar precios: ${err.message}`);
        throw err;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  async init() {
    const hadCache = await this.loadCache();
    const first = this.refresh().catch(() => {});
    // Si no hay caché hay que esperar a la primera descarga.
    if (!hadCache) await first;
    if (this.refreshMs > 0) {
      this.timer = setInterval(() => this.refresh().catch(() => {}), this.refreshMs);
      this.timer.unref?.();
      // Mientras no haya ningún dato, reintenta cada minuto.
      this.retryTimer = setInterval(() => {
        if (!this.ready) this.refresh().catch(() => {});
      }, Math.min(60_000, this.refreshMs));
      this.retryTimer.unref?.();
    }
  }

  /** Precios de ayer de una estación (o null si aún no se han descargado). */
  prevFor(id) {
    return this.prev?.byId.get(id) ?? null;
  }

  /**
   * Descarga (una vez al día) los precios de ayer de todas las estaciones,
   * para mostrar si el precio ha subido o bajado.
   */
  ensurePrev(now = new Date()) {
    if (!this.loadPrev) return Promise.resolve();
    const date = madridDate(now, -1);
    if (this.prev?.date === date) return Promise.resolve();
    if (this.loadingPrev) return this.loadingPrev;
    this.loadingPrev = (async () => {
      try {
        const file = this.prevCacheFile?.(date);
        if (file) {
          try {
            const d = JSON.parse(await readFile(file, 'utf8'));
            if (d.date === date) {
              this.prev = { date, byId: new Map(Object.entries(d.prices)) };
              return;
            }
          } catch { /* sin caché de ayer */ }
        }
        const t0 = Date.now();
        const [y, m, dd] = date.split('-').map(Number);
        const parsed = parseResponse(await this.loadPrev(new Date(y, m - 1, dd, 12)));
        this.prev = { date, byId: new Map(parsed.stations.map((s) => [s.id, s.prices])) };
        try { this.onPrev?.(date, parsed.stations); } catch { /* no debe romper la descarga */ }
        this.log.info?.(`Precios de ayer (${date}): ${parsed.stations.length} estaciones en ${Date.now() - t0} ms`);
        if (file) {
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, JSON.stringify({ date, prices: Object.fromEntries(this.prev.byId) })).catch(() => {});
        }
      } catch (err) {
        this.log.warn?.(`No se pudieron descargar los precios de ayer: ${err.message}`);
      } finally {
        this.loadingPrev = null;
      }
    })();
    return this.loadingPrev;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  status() {
    return {
      source: this.source,
      ready: this.ready,
      count: this.stations.length,
      fecha: this.fecha,
      updatedAt: this.updatedAt,
      fetchedAt: this.fetchedAt,
      lastError: this.lastError,
      prevDate: this.prev?.date ?? null,
    };
  }

  /** Carburantes presentes en los datos y cuántas estaciones los venden. */
  fuelCounts() {
    const counts = {};
    for (const s of this.stations) for (const k of Object.keys(s.prices)) counts[k] = (counts[k] ?? 0) + 1;
    return counts;
  }
}
