// Lectura de los datos del localizador oficial de Club MAPFRE
// (mapfretecuidamos.com/gasolineras). Funciona en el navegador y en Node.
//
// Admite:
//  - la respuesta tal cual: { message: { contenido: [ ... ] } }
//  - una lista de respuestas o de estaciones
//  - un fichero HAR exportado desde la pestaña Red del navegador; solo se leen
//    las respuestas de "collaborating-center" y se ignora todo lo demás
//    (cabeceras, cookies...).

const TIPO_BY_CODE = { 3: 'colaboradora', 4: 'repsol' };

function num(v) {
  if (v == null) return null;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
}

function b64(text) {
  if (typeof atob === 'function') {
    const bin = atob(text);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(text, 'base64').toString('utf8');
}

export function parseLocatorPayload(payload) {
  const out = [];
  const visit = (x, depth = 0) => {
    if (!x || depth > 6) return;
    if (Array.isArray(x)) return x.forEach((y) => visit(y, depth + 1));
    if (typeof x !== 'object') return;
    if (x.message?.contenido) return visit(x.message.contenido, depth + 1);
    if (x.contenido) return visit(x.contenido, depth + 1);
    if (x.log?.entries) {
      for (const e of x.log.entries) {
        if (!/collaborating-center/.test(e.request?.url ?? '')) continue;
        const text = e.response?.content?.text;
        if (!text) continue;
        try {
          visit(JSON.parse(e.response.content.encoding === 'base64' ? b64(text) : text), depth + 1);
        } catch {
          /* respuesta que no es JSON */
        }
      }
      return;
    }
    const lat = num(x.latitud ?? x.lat);
    const lon = num(x.longitud ?? x.lng ?? x.lon);
    if (lat == null || lon == null) return;
    out.push({
      nombre: String(x.nombreCentro ?? x.nombre ?? '').trim().slice(0, 120),
      tipo: TIPO_BY_CODE[Number(x.codigoTipoColaborador)] ?? (['repsol', 'colaboradora'].includes(x.tipo) ? x.tipo : 'colaboradora'),
      direccion: String(x.direccion ?? '').trim().slice(0, 200),
      localidad: String(x.localidad ?? '').trim().slice(0, 100),
      ventajas: String(x.ventajas ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
      lat,
      lon,
    });
  };
  visit(payload);
  // Sin duplicados: las búsquedas de zonas cercanas se solapan.
  const seen = new Set();
  return out.filter((e) => {
    const k = `${e.lat.toFixed(5)},${e.lon.toFixed(5)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
