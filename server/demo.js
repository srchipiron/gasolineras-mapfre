// Modo demostración (DEMO=1): datos inventados con el mismo formato que la API
// del Ministerio, para probar la app sin conexión. NO son precios reales.

import { haversineKm } from '../shared/geo.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_CITIES = [
  { name: 'Madrid', province: 'MADRID', idProv: '28', lat: 40.4168, lon: -3.7038, cp: '28013', n: 140, spread: 12 },
  { name: 'Barcelona', province: 'BARCELONA', idProv: '08', lat: 41.3874, lon: 2.1686, cp: '08002', n: 90, spread: 9 },
  { name: 'Valencia', province: 'VALENCIA / VALÈNCIA', idProv: '46', lat: 39.4699, lon: -0.3763, cp: '46002', n: 70, spread: 8 },
  { name: 'Sevilla', province: 'SEVILLA', idProv: '41', lat: 37.3891, lon: -5.9845, cp: '41004', n: 60, spread: 8 },
  { name: 'Zaragoza', province: 'ZARAGOZA', idProv: '50', lat: 41.6488, lon: -0.8891, cp: '50001', n: 45, spread: 7 },
  { name: 'Málaga', province: 'MÁLAGA', idProv: '29', lat: 36.7213, lon: -4.4214, cp: '29015', n: 45, spread: 7 },
  { name: 'Bilbao', province: 'BIZKAIA', idProv: '48', lat: 43.263, lon: -2.935, cp: '48001', n: 35, spread: 6 },
  { name: 'Valladolid', province: 'VALLADOLID', idProv: '47', lat: 41.6523, lon: -4.7245, cp: '47001', n: 30, spread: 6 },
  { name: 'Cuenca', province: 'CUENCA', idProv: '16', lat: 40.0704, lon: -2.1374, cp: '16001', n: 12, spread: 4 },
];

// Corredores por autovía para probar la búsqueda en ruta.
const CORRIDORS = [
  ['Madrid', 'Valencia', 40],
  ['Madrid', 'Zaragoza', 30],
  ['Madrid', 'Sevilla', 40],
  ['Zaragoza', 'Barcelona', 25],
];

const BRANDS = [
  { name: 'REPSOL', w: 22, off: 0.055 },
  { name: 'MOEVE', w: 12, off: 0.045 },
  { name: 'GALP', w: 10, off: 0.03 },
  { name: 'BP', w: 8, off: 0.045 },
  { name: 'SHELL', w: 5, off: 0.06 },
  { name: 'PLENOIL', w: 7, off: -0.085 },
  { name: 'BALLENOIL', w: 6, off: -0.075 },
  { name: 'PETROPRIX', w: 4, off: -0.08 },
  { name: 'CARREFOUR', w: 4, off: -0.03 },
  { name: 'ALCAMPO', w: 3, off: -0.04 },
  { name: 'AVIA', w: 4, off: 0.0 },
  { name: 'PETRONOR', w: 3, off: 0.05 },
  { name: 'GALP ENERGIA', w: 2, off: 0.025 },
  { name: 'E.S. LOS PINOS', w: 2, off: -0.01 },
  { name: 'GASOLINERA SAN JUAN', w: 2, off: -0.02 },
  { name: 'COOPERATIVA AGRICOLA', w: 1, off: -0.05, restricted: true },
];

const STREETS = [
  'CALLE MAYOR', 'AVENIDA DE LA CONSTITUCIÓN', 'CARRETERA NACIONAL', 'AVENIDA DE ANDALUCÍA',
  'CALLE REAL', 'PASEO DE LA CASTELLANA', 'AVENIDA DEL MEDITERRÁNEO', 'CALLE DEL PILAR',
  'POLÍGONO INDUSTRIAL LAS ARENAS', 'RONDA SUR', 'AVENIDA DE EUROPA', 'CALLE SAN ISIDRO',
];

const SCHEDULES = [
  'L-D: 24H', 'L-D: 24H', 'L-D: 24H', 'L-D: 06:00-23:00', 'L-V: 06:00-22:00; S: 07:00-15:00',
  'L-S: 07:00-22:00; D: 08:00-15:00', 'L-V: 07:00-14:30 y 16:00-21:00; S: 08:00-14:00', 'L-D: 07:00-22:00',
];

const fmt = (n) => n.toFixed(3).replace('.', ',');
const coord = (n) => n.toFixed(6).replace('.', ',');

function pickWeighted(rnd, items) {
  const total = items.reduce((s, i) => s + i.w, 0);
  let x = rnd() * total;
  for (const it of items) if ((x -= it.w) < 0) return it;
  return items[items.length - 1];
}

function rawStation(rnd, id, { lat, lon, city, locality }) {
  const brand = pickWeighted(rnd, BRANDS);
  const noise = () => (rnd() - 0.5) * 0.05;
  const base = brand.off + noise();
  const diesel = 1.469 + base;
  const g95 = 1.539 + base + (rnd() - 0.5) * 0.02;
  const hasPremium = !['PLENOIL', 'BALLENOIL', 'PETROPRIX'].includes(brand.name);
  const muni = locality ?? city.name;
  return {
    'C.P.': city.cp,
    'Dirección': `${STREETS[Math.floor(rnd() * STREETS.length)]}, ${1 + Math.floor(rnd() * 180)}`,
    'Horario': SCHEDULES[Math.floor(rnd() * SCHEDULES.length)],
    'Latitud': coord(lat),
    'Localidad': muni.toUpperCase(),
    'Longitud (WGS84)': coord(lon),
    'Margen': rnd() < 0.5 ? 'D' : 'I',
    'Municipio': muni,
    'Precio Biodiesel': '',
    'Precio Bioetanol': '',
    'Precio Gas Natural Comprimido': rnd() < 0.04 ? fmt(1.199 + noise()) : '',
    'Precio Gas Natural Licuado': '',
    'Precio Gases licuados del petróleo': rnd() < 0.18 ? fmt(0.959 + noise()) : '',
    'Precio Gasoleo A': fmt(diesel),
    'Precio Gasoleo B': rnd() < 0.15 ? fmt(diesel - 0.38) : '',
    'Precio Gasoleo Premium': hasPremium ? fmt(diesel + 0.085 + noise() / 3) : '',
    'Precio Gasolina 95 E10': '',
    'Precio Gasolina 95 E5': fmt(g95),
    'Precio Gasolina 95 E5 Premium': hasPremium && rnd() < 0.3 ? fmt(g95 + 0.06) : '',
    'Precio Gasolina 98 E10': '',
    'Precio Gasolina 98 E5': hasPremium ? fmt(g95 + 0.13 + noise() / 3) : '',
    'Precio Hidrogeno': '',
    'Provincia': city.province,
    'Remisión': 'dm',
    'Rótulo': brand.name,
    'Tipo Venta': brand.restricted ? 'R' : 'P',
    '% BioEtanol': '0,0',
    '% Éster metílico': '0,0',
    'IDEESS': String(id),
    'IDMunicipio': String(4000 + DEMO_CITIES.indexOf(city)),
    'IDProvincia': city.idProv,
    'IDCCAA': '13',
  };
}

/** Respuesta con el formato exacto de /EstacionesTerrestres/. */
export function generateDemoResponse(now = new Date()) {
  const rnd = mulberry32(20261117);
  const list = [];
  let id = 10000;
  for (const city of DEMO_CITIES) {
    for (let i = 0; i < city.n; i++) {
      const r = city.spread * Math.sqrt(rnd());
      const a = rnd() * Math.PI * 2;
      const lat = city.lat + (r / 110.574) * Math.sin(a);
      const lon = city.lon + (r / (111.32 * Math.cos((city.lat * Math.PI) / 180))) * Math.cos(a);
      list.push(rawStation(rnd, id++, { lat, lon, city }));
    }
  }
  for (const [fromName, toName, n] of CORRIDORS) {
    const from = DEMO_CITIES.find((c) => c.name === fromName);
    const to = DEMO_CITIES.find((c) => c.name === toName);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const lat = from.lat + (to.lat - from.lat) * t + (rnd() - 0.5) * 0.02;
      const lon = from.lon + (to.lon - from.lon) * t + (rnd() - 0.5) * 0.02;
      const city = t < 0.5 ? from : to;
      list.push(rawStation(rnd, id++, { lat, lon, city, locality: `Área de servicio km ${Math.round(t * 350)}` }));
    }
  }
  const p = (n) => String(n).padStart(2, '0');
  return {
    Fecha: `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}:00`,
    ListaEESSPrecio: list,
    Nota: 'DATOS DE DEMOSTRACIÓN - no son precios reales',
    ResultadoConsulta: 'OK',
  };
}

export function createDemoGeocoder() {
  return {
    async search(q) {
      const n = q.trim().toLowerCase();
      const hits = DEMO_CITIES.filter(
        (c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()) || c.cp.startsWith(n.slice(0, 2)),
      );
      return hits.map((c) => ({ label: `${c.name}, ${c.province}, España (demo)`, lat: c.lat, lon: c.lon }));
    },
  };
}

export function createDemoRouter() {
  return {
    async route(from, to) {
      const steps = 120;
      const polyline = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        polyline.push([from.lat + (to.lat - from.lat) * t, from.lon + (to.lon - from.lon) * t]);
      }
      const distanceKm = haversineKm(from.lat, from.lon, to.lat, to.lon) * 1.2;
      return { distanceKm, durationMin: (distanceKm / 95) * 60, polyline };
    },
  };
}

export function createDemoHistory() {
  return {
    async forStation(station, days = 30, today = new Date()) {
      const rnd = mulberry32(Number(station.id) || 1);
      const series = [];
      const drift = {};
      for (let i = days; i >= 1; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const prices = {};
        for (const [k, v] of Object.entries(station.prices)) {
          drift[k] = (drift[k] ?? (rnd() - 0.5) * 0.06) * 0.85 + (rnd() - 0.5) * 0.012;
          prices[k] = Math.round((v + drift[k]) * 1000) / 1000;
        }
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        series.push({ date: key, prices });
      }
      const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      series.push({ date: key, prices: station.prices });
      return { series, missingDays: 0 };
    },
  };
}
