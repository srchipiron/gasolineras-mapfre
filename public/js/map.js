// Mapa con Leaflet + OpenStreetMap.

import { priceLevel } from '/shared/ranking.js';
import { num3, esc } from './format.js';

export function createMap(el, { onSelect }) {
  const L = window.L;
  if (!L) {
    el.innerHTML = '<p class="map-error">No se pudo cargar el mapa.</p>';
    return { showResults() {}, showRoute() {}, showUser() {}, focus() {}, invalidate() {}, clearRoute() {} };
  }
  const map = L.map(el, { zoomControl: true, attributionControl: true, zoomSnap: 0.25 }).setView([40.2, -3.7], 6);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

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

  function icon(r, summary, { best, labelled }) {
    const level = priceLevel(r.price, summary);
    const flags = [level, r.mapfre ? 'mapfre' : '', best ? 'top' : '', r.open === false ? 'closed' : ''];
    if (!labelled) {
      return L.divIcon({
        className: 'pin-wrap',
        html: `<div class="${['dot', ...flags].filter(Boolean).join(' ')}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
    }
    const label = num3(r.mapfre ? r.effective : r.price);
    return L.divIcon({
      className: 'pin-wrap',
      html: `<div class="${['pin', ...flags].filter(Boolean).join(' ')}">${r.mapfre ? '<i aria-hidden="true">🍀</i>' : ''}${esc(label)}</div>`,
      iconSize: [64, 26],
      iconAnchor: [32, 30],
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
    // Se dibujan de cara a barata para que las baratas queden encima.
    for (let i = byPrice.length - 1; i >= 0; i--) {
      const r = byPrice[i];
      const best = r.station.id === bestId || r.station.id === bestMapfreId;
      const labelled = labelAll || i < LABEL_LIMIT || best;
      const m = L.marker([r.station.lat, r.station.lon], {
        icon: icon(r, summary, { best, labelled }),
        title: `${r.station.brand} · ${num3(r.mapfre ? r.effective : r.price)} €`,
        riseOnHover: true,
        zIndexOffset: best ? 2000 : labelled ? 1000 - i : 0,
      });
      m.on('click', () => onSelect(r));
      m.addTo(markerLayer);
      byId.set(r.station.id, m);
    }
  }

  let lastLabelAll = null;
  map.on('zoomend', () => {
    const labelAll = map.getZoom() >= LABEL_ALL_ZOOM;
    if (labelAll !== lastLabelAll) {
      lastLabelAll = labelAll;
      drawMarkers();
    }
  });

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
