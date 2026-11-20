// Mapa con Leaflet + OpenStreetMap.

import { priceLevel } from '/shared/ranking.js';
import { spreadPins } from '/shared/pins.js';
import { num3, esc } from './format.js';

export function createMap(el, { onSelect }) {
  const L = window.L;
  if (!L) {
    el.innerHTML = '<p class="map-error">No se pudo cargar el mapa.</p>';
    return { showResults() {}, showRoute() {}, showUser() {}, focus() {}, invalidate() {}, clearRoute() {} };
  }
  const map = L.map(el, { zoomControl: true, attributionControl: true, zoomSnap: 0.25 }).setView([40.2, -3.7], 6);
  // Mapa de OpenStreetMap. Sus servidores exigen el origen de la web
  // (Referer). En modo oscuro se oscurece con un filtro CSS (ver app.css):
  // los proveedores con mapa oscuro propio, como CARTO, piden clave de API.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    referrerPolicy: 'strict-origin-when-cross-origin',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // Leyenda plegable.
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `<details>
      <summary>Leyenda</summary>
      <ul>
        <li><span class="sw cheap"></span> Barata · <span class="sw mid"></span> Media · <span class="sw expensive"></span> Cara</li>
        <li><span class="sw mapfre"></span> 🍀 En la lista oficial de Club MAPFRE (precio ya con tréboles)</li>
        <li><span class="sw dot"></span> Más gasolineras: acerca el mapa para ver su precio</li>
      </ul></details>`;
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  legend.addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  const areaLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const byId = new Map();
  let userMarker = null;
  let current = { results: [], summary: null };

  // Para que el mapa se pueda leer, solo llevan etiqueta de precio las más
  // baratas; el resto es un punto de color. Con zoom cercano, todas.
  const LABEL_LIMIT = window.innerWidth < 600 ? 15 : 30;
  const LABEL_ALL_ZOOM = 15;

  // Tamaño y ancla [ancho, alto, ancla vertical] de cada tipo de pin.
  const PIN = [64, 26, 30];
  const DOT = [14, 14, 7];

  function icon(r, summary, { best, labelled, dy = 0 }) {
    const level = priceLevel(r.price, summary);
    const flags = [level, r.mapfre ? 'mapfre' : '', r.mapfre && r.approx ? 'approx' : '', best ? 'top' : '', r.open === false ? 'closed' : '', dy ? 'moved' : ''];
    const [w, h, ay] = labelled ? PIN : DOT;
    // Si se ha apartado para no tapar a otra muy cercana, el ancla se corre
    // (dy > 0: el pin se dibuja más abajo de su punto).
    const anchor = [w / 2, ay - dy];
    if (!labelled) {
      return L.divIcon({
        className: 'pin-wrap',
        html: `<div class="${['dot', ...flags].filter(Boolean).join(' ')}"></div>`,
        iconSize: [w, h],
        iconAnchor: anchor,
      });
    }
    const label = num3(r.mapfre ? r.effective : r.price);
    return L.divIcon({
      className: 'pin-wrap',
      html: `<div class="${['pin', ...flags].filter(Boolean).join(' ')}">${r.mapfre ? '<i aria-hidden="true">🍀</i>' : ''}${esc(label)}</div>`,
      iconSize: [w, h],
      iconAnchor: anchor,
    });
  }

  function drawMarkers() {
    const { results, summary } = current;
    markerLayer.clearLayers();
    byId.clear();
    const bestId = summary?.bestEffective?.station.id;
    const bestMapfreId = summary?.bestMapfre?.station.id;
    const byPrice = results.slice().sort((a, b) => a.effective - b.effective);
    const labelAll = map.getZoom() >= LABEL_ALL_ZOOM;
    // Se destaca la que te aconseja la app (según el modo); si no hay, las mejores.
    const recId = summary?.recommended?.station.id;
    const isBest = (r) => (recId ? r.station.id === recId : r.station.id === bestId || r.station.id === bestMapfreId);
    const info = byPrice.map((r, i) => ({ r, i, best: isBest(r), labelled: labelAll || i < LABEL_LIMIT || isBest(r) }));
    // Las gasolineras casi pegadas (una a cada lado de la autovía…) se apartan
    // para que no quede ninguna escondida debajo de otra. Se colocan primero
    // la aconsejada, luego las que llevan precio y luego los puntos.
    const zoom = map.getZoom();
    const order = info.slice().sort((a, b) => b.best - a.best || b.labelled - a.labelled || a.i - b.i);
    const dys = spreadPins(order.map(({ r, labelled }) => {
      const p = map.project([r.station.lat, r.station.lon], zoom);
      const [w, h, ay] = labelled ? PIN : DOT;
      return { x: p.x, y: p.y, w, h, ay, lat: r.station.lat, lon: r.station.lon };
    }));
    order.forEach((o, k) => { o.dy = dys[k]; });
    // Se dibujan de cara a barata para que las baratas queden encima.
    for (let i = info.length - 1; i >= 0; i--) {
      const { r, best, labelled, dy } = info[i];
      const m = L.marker([r.station.lat, r.station.lon], {
        icon: icon(r, summary, { best, labelled, dy }),
        title: `${r.station.brand} · ${num3(r.mapfre ? r.effective : r.price)} €`,
        riseOnHover: true,
        zIndexOffset: best ? 2000 : labelled ? 1000 - i : 0,
      });
      m.on('click', () => onSelect(r));
      m.addTo(markerLayer);
      byId.set(r.station.id, m);
    }
  }

  // Con cada zoom cambia qué pines se tocan: se vuelven a colocar.
  map.on('zoomend', () => drawMarkers());

  return {
    showResults(results, summary, { center, radiusKm, fit = true } = {}) {
      areaLayer.clearLayers();
      current = { results, summary };
      drawMarkers();
      if (center && radiusKm) {
        L.circle([center.lat, center.lon], {
          radius: radiusKm * 1000,
          color: '#14804a',
          weight: 1,
          fillOpacity: 0.04,
          interactive: false,
        }).addTo(areaLayer);
      }
      if (fit) {
        if (center && radiusKm) map.fitBounds(L.latLng(center.lat, center.lon).toBounds(radiusKm * 2000), { padding: [10, 10] });
        else if (results.length) map.fitBounds(L.latLngBounds(results.map((r) => [r.station.lat, r.station.lon])), { padding: [30, 30] });
      }
    },
    showRoute(polyline) {
      routeLayer.clearLayers();
      if (!polyline?.length) return;
      const line = L.polyline(polyline, { color: '#2563eb', weight: 5, opacity: 0.75 }).addTo(routeLayer);
      L.circleMarker(polyline[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }).addTo(routeLayer);
      L.circleMarker(polyline[polyline.length - 1], { radius: 7, color: '#fff', weight: 2, fillColor: '#dc2626', fillOpacity: 1 }).addTo(routeLayer);
      map.fitBounds(line.getBounds(), { padding: [30, 30] });
    },
    clearRoute() {
      routeLayer.clearLayers();
    },
    showUser(lat, lon) {
      if (userMarker) userMarker.remove();
      userMarker = L.circleMarker([lat, lon], {
        radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, interactive: false,
      }).addTo(map);
    },
    focus(id) {
      const m = byId.get(id);
      if (!m) return;
      map.setView(m.getLatLng(), Math.max(map.getZoom(), 15), { animate: true });
    },
    invalidate() {
      map.invalidateSize();
    },
  };
}
