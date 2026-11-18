// Tendencia de precios: precio medio de cada carburante por provincia (y en
// toda España) en los últimos días, a partir de los datos diarios del
// Ministerio (EstacionesTerrestresHist). Se guarda solo la media de cada día,
// no las estaciones, así que ocupa muy poco.

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseResponse } from './minetur.js';
import { madridDate } from './store.js';

export const TREND_DAYS = 14;
const KEEP_DAYS = 31;

/**
 * Media de cada carburante por provincia y en España ('ES') para un día.
 * Solo cuentan las gasolineras de venta al público.
 * @returns {{ [provincia: string]: { [carburante: string]: number } }}
 */
export function dayAverages(stations) {
  const acc = {};
  for (const s of stations) {
    if (s.saleType === 'R') continue;
    for (const [fuel, price] of Object.entries(s.prices ?? {})) {
      if (!(price > 0)) continue;
      for (const key of [s.idProvincia, 'ES']) {
        if (!key) continue;
        const a = ((acc[key] ??= {})[fuel] ??= [0, 0]);
        a[0] += price;
        a[1]++;
      }
    }
  }
  const out = {};
  for (const [key, fuels] of Object.entries(acc)) {
    out[key] = {};
    for (const [fuel, [sum, n]] of Object.entries(fuels)) out[key][fuel] = Math.round((sum / n) * 10000) / 10000;
  }
  return out;
}

/** Fecha aaaa-mm-dd -> Date a mediodía (para los endpoints históricos). */
const noon = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class TrendStore {
  /**
   * @param {object} o
   * @param {(date: Date) => Promise<object>} o.loadDay respuesta en bruto de un día pasado
   * @param {string} [o.cacheFile]
   * @param {number} [o.days] días hacia atrás que se descargan
   * @param {number} [o.delayMs] pausa entre descargas, para no cargar al Ministerio
   */
  constructor({ loadDay, cacheFile = null, days = TREND_DAYS, delayMs = 20_000, logger = console }) {
    this.loadDay = loadDay;
    this.cacheFile = cacheFile;
    this.daysBack = days;
    this.delayMs = delayMs;
    this.log = logger;
    this.days = new Map(); // fecha -> medias
    this.filling = null;
    this.timer = null;
  }

  /** Guarda las medias de un día a partir de sus estaciones. */
  addDay(date, stations) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !stations?.length) return;
    this.days.set(date, dayAverages(stations));
    this.prune();
    this.save().catch((e) => this.log.warn?.(`No se pudo guardar la tendencia: ${e.message}`));
  }

  prune(now = new Date()) {
    const oldest = madridDate(now, -KEEP_DAYS);
    for (const d of this.days.keys()) if (d < oldest) this.days.delete(d);
  }

  async loadCache() {
    if (!this.cacheFile) return;
    try {
      const data = JSON.parse(await readFile(this.cacheFile, 'utf8'));
      for (const [date, avgs] of Object.entries(data.days ?? {})) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && avgs && typeof avgs === 'object') this.days.set(date, avgs);
      }
      this.prune();
    } catch {
      /* sin caché */
    }
  }

  async save() {
    if (!this.cacheFile) return;
    await mkdir(dirname(this.cacheFile), { recursive: true });
    const tmp = `${this.cacheFile}.tmp`;
    await writeFile(tmp, JSON.stringify({ days: Object.fromEntries([...this.days].sort()) }));
    await rename(tmp, this.cacheFile);
  }

  /** Días de los últimos `daysBack` que faltan (sin contar hoy), del más reciente al más antiguo. */
  missing(now = new Date()) {
    const out = [];
    for (let i = 1; i <= this.daysBack; i++) {
      const d = madridDate(now, -i);
      if (!this.days.has(d)) out.push(d);
    }
    return out;
  }

  /** Descarga, uno a uno y con pausas, los días que faltan. */
  fill(now = new Date()) {
    if (this.filling) return this.filling;
    this.filling = (async () => {
      const todo = this.missing(now);
      for (const [i, date] of todo.entries()) {
        try {
          const t0 = Date.now();
          const { stations } = parseResponse(await this.loadDay(noon(date)));
          this.addDay(date, stations);
          this.log.info?.(`Tendencia: medias del ${date} (${stations.length} estaciones) en ${Date.now() - t0} ms`);
        } catch (err) {
          this.log.warn?.(`Tendencia: no se pudo descargar el ${date}: ${err.message}`);
          break; // se reintenta más tarde
        }
        if (i < todo.length - 1) await sleep(this.delayMs);
      }
    })().finally(() => {
      this.filling = null;
    });
    return this.filling;
  }

  /** Arranca: lee la caché y rellena los huecos al rato y cada 6 horas. */
  async init({ startDelayMs = 90_000 } = {}) {
    await this.loadCache();
    const kick = () => this.fill().catch(() => {});
    const first = setTimeout(kick, startDelayMs);
    first.unref?.();
    this.timer = setInterval(kick, 6 * 3600 * 1000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Serie de los últimos días para una provincia y un carburante.
   * @param {{ province: string, fuel: string, today?: object, now?: Date }} o
   *   today: medias de hoy (de los precios actuales), opcional
   */
  series({ province, fuel, today = null, now = new Date() }) {
    const out = [];
    for (let i = this.daysBack; i >= 1; i--) {
      const date = madridDate(now, -i);
      const day = this.days.get(date);
      out.push({ date, avg: day?.[province]?.[fuel] ?? null, es: day?.ES?.[fuel] ?? null });
    }
    out.push({ date: madridDate(now), avg: today?.[province]?.[fuel] ?? null, es: today?.ES?.[fuel] ?? null });
    return out;
  }
}

/**
 * Resume una serie: cuánto ha cambiado el precio medio en la última semana.
 * @returns {{ last: number|null, ref: number|null, change: number|null, trend: 'up'|'down'|'flat'|null, days: number }}
 */
export function trendSummary(series, key = 'avg', { window = 7, flat = 0.005 } = {}) {
  const pts = series.filter((p) => p[key] != null);
  if (pts.length < 2) return { last: pts.at(-1)?.[key] ?? null, ref: null, change: null, trend: null, days: 0 };
  const last = pts.at(-1);
  // El punto más cercano a hace `window` días (si faltan días, el más próximo).
  const t = (p) => new Date(`${p.date}T12:00:00Z`).getTime();
  const target = t(last) - window * 86400000;
  const ref = pts.slice(0, -1).reduce((best, p) => (Math.abs(t(p) - target) < Math.abs(t(best) - target) ? p : best));
  const days = Math.round((new Date(`${last.date}T12:00:00Z`) - new Date(`${ref.date}T12:00:00Z`)) / 86400000);
  if (days < 1) return { last: last[key], ref: null, change: null, trend: null, days: 0 };
  const change = Math.round((last[key] - ref[key]) * 10000) / 10000;
  const trend = Math.abs(change) < flat ? 'flat' : change > 0 ? 'up' : 'down';
  return { last: last[key], ref: ref[key], change, trend, days };
}
