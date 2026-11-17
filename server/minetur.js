// Cliente y parser de la API REST de precios de carburantes del Ministerio
// para la Transición Ecológica (Geoportal de Hidrocarburos).
// Documentación: https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help

import { fuelKeyForField } from '../shared/fuels.js';
import { fetchJson } from './http.js';

export const DEFAULT_BASE_URL =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';

/** "1,459" -> 1.459 ; "" -> null */
export function parseNumber(value) {
  if (value == null) return null;
  const t = String(value).trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const clean = (s) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim());

const SMALL_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a']);

function titleCase(s) {
  return clean(s)
    .toLowerCase()
    .split(' ')
    .map((w, i) =>
      i > 0 && SMALL_WORDS.has(w) ? w : w.replace(/(^|[/(-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase()),
    )
    .join(' ');
}

/** Convierte una estación en bruto de la API en el formato interno. */
export function parseStation(raw) {
  const lat = parseNumber(raw['Latitud']);
  const lon = parseNumber(raw['Longitud (WGS84)'] ?? raw['Longitud']);
  const id = clean(raw['IDEESS']);
  if (lat == null || lon == null || !id) return null;
  const prices = {};
  for (const [field, value] of Object.entries(raw)) {
    const key = fuelKeyForField(field);
    if (!key) continue;
    const n = parseNumber(value);
    if (n != null && n > 0) prices[key] = n;
  }
  return {
    id,
    brand: clean(raw['Rótulo']) || 'Sin rótulo',
    address: titleCase(raw['Dirección']),
    locality: titleCase(raw['Localidad']),
    municipality: titleCase(raw['Municipio']),
    province: titleCase(raw['Provincia']),
    postalCode: clean(raw['C.P.']),
    lat,
    lon,
    schedule: clean(raw['Horario']),
    saleType: clean(raw['Tipo Venta']) || 'P', // P = venta al público, R = restringida
    margin: clean(raw['Margen']),
    idMunicipio: clean(raw['IDMunicipio']),
    idProvincia: clean(raw['IDProvincia']),
    prices,
  };
}

/** "17/11/2026 21:30:05" -> Date (hora peninsular). */
export function parseFecha(fecha) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(clean(fecha));
  if (!m) return null;
  // La API publica la hora oficial peninsular; la representamos tal cual.
  return `${m[3]}-${m[2]}-${m[1]}T${m[4].padStart(2, '0')}:${m[5]}:${m[6] ?? '00'}`;
}

export function parseResponse(json) {
  if (!json || !Array.isArray(json.ListaEESSPrecio)) {
    throw new Error('Formato inesperado: falta ListaEESSPrecio');
  }
  if (json.ResultadoConsulta && json.ResultadoConsulta !== 'OK') {
    throw new Error(`La API respondió: ${json.ResultadoConsulta}`);
  }
  const stations = [];
  for (const raw of json.ListaEESSPrecio) {
    const st = parseStation(raw);
    if (st) stations.push(st);
  }
  return { fecha: clean(json.Fecha), updatedAt: parseFecha(json.Fecha), stations };
}

/** dd-mm-yyyy para los endpoints históricos. */
export function histDate(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getFullYear()}`;
}

export function createMineturClient({ baseUrl = DEFAULT_BASE_URL, timeoutMs = 90000 } = {}) {
  return {
    /** Todas las estaciones terrestres de España con sus precios actuales. */
    async fetchAll() {
      return fetchJson(`${baseUrl}/EstacionesTerrestres/`, { timeoutMs });
    },
    /** Precios de un municipio en una fecha pasada. */
    async fetchHistMunicipio(date, idMunicipio) {
      return fetchJson(
        `${baseUrl}/EstacionesTerrestresHist/FiltroMunicipio/${histDate(date)}/${encodeURIComponent(idMunicipio)}`,
        { timeoutMs: 30000 },
      );
    },
  };
}
