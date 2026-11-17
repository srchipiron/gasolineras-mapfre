// Almacén en memoria de las estaciones, con refresco periódico y copia en
// disco para arrancar sin conexión o si el Ministerio no responde.

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseResponse } from './minetur.js';

export class StationStore {
  /**
   * @param {object} o
   * @param {() => Promise<object>} o.load devuelve la respuesta en bruto de la API
   * @param {string} [o.cacheFile] ruta del JSON cacheado en disco
   * @param {number} [o.refreshMs] cada cuánto refrescar (0 = nunca)
   * @param {string} [o.source] 'minetur' | 'demo'
   */
  constructor({ load, cacheFile, refreshMs = 30 * 60 * 1000, source = 'minetur', logger = console }) {
    this.load = load;
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
    };
  }

  /** Carburantes presentes en los datos y cuántas estaciones los venden. */
  fuelCounts() {
    const counts = {};
    for (const s of this.stations) for (const k of Object.keys(s.prices)) counts[k] = (counts[k] ?? 0) + 1;
    return counts;
  }
}
