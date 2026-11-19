// Cliente de la API del servidor.

import { nominatimUrl, parseNominatim } from '/shared/geocode.js';

async function get(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  const res = await fetch(qs ? `${path}?${qs}` : path, { headers: { Accept: 'application/json' } });
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* respuesta vacía */
  }
  if (!res.ok) throw Object.assign(new Error(body.error || `Error ${res.status}`), { status: res.status });
  return body;
}

export const api = {
  status: () => get('/api/status'),
  program: () => get('/api/program'),
  fuels: () => get('/api/fuels'),
  stations: ({ lat, lon, radius, fuel, publicOnly }) =>
    get('/api/stations', { lat, lon, radius, fuel, public: publicOnly ? 1 : 0 }),
  byIds: (ids) => get('/api/stations/byIds', { ids: ids.join(',') }),
  station: (id) => get(`/api/stations/${encodeURIComponent(id)}`),
  route: ({ from, to, corridor, fuel, publicOnly }) =>
    get('/api/route', {
      from: `${from.lat},${from.lon}`,
      to: `${to.lat},${to.lon}`,
      corridor,
      fuel,
      public: publicOnly ? 1 : 0,
    }),
  geocode: async (q) => {
    // Primero desde el móvil, con su propia IP: Nominatim limita la IP
    // compartida del servidor (Render gratuito) y responde 429. Si falla,
    // el servidor lo intenta con Nominatim y, si no, con Photon.
    try {
      const res = await fetch(nominatimUrl(q), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (res.ok) return { results: parseNominatim(await res.json()) };
    } catch {
      /* sin conexión directa o bloqueado: se pregunta al servidor */
    }
    return get('/api/geocode', { q });
  },
  adheridas: () => get('/api/adheridas'),
  // La misma lista, empaquetada con la app (precargada por el service worker).
  adheridasLocal: () => get('/data/adheridas.json'),
  publishOfficial: async ({ key, list }) => {
    const res = await fetch('/api/adheridas/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ key, list }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
    return body;
  },
  matchOfficial: async (entries) => {
    const res = await fetch('/api/adheridas/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ entries }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
    return body;
  },
  /** La lista del mapa oficial que subió el marcador «Enviar a Tréboles» (una sola vez). */
  capture: async (code) => {
    const res = await fetch(`/api/adheridas/captura/${encodeURIComponent(code)}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
    return body.entries ?? [];
  },
  trend: ({ province, fuel }) => get('/api/trend', { province, fuel }),
  history: (id, days = 30) => get(`/api/history/${encodeURIComponent(id)}`, { days }),
};
