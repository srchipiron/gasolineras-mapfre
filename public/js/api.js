// Cliente de la API del servidor.

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
  geocode: (q) => get('/api/geocode', { q }),
  adheridas: () => get('/api/adheridas'),
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
  history: (id, days = 30) => get(`/api/history/${encodeURIComponent(id)}`, { days }),
};
