// Búsqueda de direcciones en España. Funciona en el navegador y en Node.
//
//  - Nominatim (OpenStreetMap): el buscador principal.
//  - Photon (komoot, también con datos de OpenStreetMap): la alternativa
//    cuando Nominatim limita las peticiones (429), algo habitual desde
//    servidores con IP compartida como Render gratuito.

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
export const PHOTON_URL = 'https://photon.komoot.io';

// España con Canarias, Ceuta y Melilla (oeste, sur, este, norte).
const SPAIN_BBOX = '-18.4,27.4,4.6,44.0';

export function nominatimUrl(q, base = NOMINATIM_URL) {
  return `${base}/search?format=jsonv2&countrycodes=es&limit=6&accept-language=es&q=${encodeURIComponent(q)}`;
}

export function photonUrl(q, base = PHOTON_URL) {
  return `${base}/api/?limit=8&bbox=${SPAIN_BBOX}&q=${encodeURIComponent(q)}`;
}

const valid = (r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.label;

export function parseNominatim(data) {
  return (Array.isArray(data) ? data : [])
    .map((r) => ({ label: String(r.display_name ?? ''), lat: Number(r.lat), lon: Number(r.lon) }))
    .filter(valid);
}

export function parsePhoton(data) {
  const seen = new Set();
  const out = [];
  for (const f of data?.features ?? []) {
    const p = f?.properties ?? {};
    if (p.countrycode && p.countrycode !== 'ES') continue;
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    const place = [p.postcode, p.city ?? p.town ?? p.village ?? p.county].filter(Boolean).join(' ');
    const parts = [];
    for (const x of [p.name, street, p.locality, place, p.state]) if (x && !parts.includes(x)) parts.push(x);
    const label = parts.join(', ');
    const [lon, lat] = f?.geometry?.coordinates ?? [];
    const r = { label, lat: Number(lat), lon: Number(lon) };
    if (!valid(r) || seen.has(label)) continue;
    seen.add(label);
    out.push(r);
    if (out.length >= 6) break;
  }
  return out;
}
