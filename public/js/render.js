// Plantillas HTML de resultados, resumen y ficha de la gasolinera.

import { html, raw, eurL, eur, km, num2, pct } from './format.js';
import { openStatus } from '/shared/horario.js';
import { FUELS, fuelLabel } from '/shared/fuels.js';
import { findRule, percentFor, effectivePrice, treblesFor } from '/shared/treboles.js';

function openBadge(r) {
  if (r.open === true) return html`<span class="badge ok">Abierta</span>`;
  if (r.open === false) return html`<span class="badge off">Cerrada</span>`;
  return '';
}

export function resultItem(r, i, { litres, mode = 'nearby', favorite = false }) {
  const st = r.station;
  const where = mode === 'route'
    ? `km ${Math.round(st.alongKm)} de la ruta · desvío ${km(st.offRouteKm)}`
    : km(st.distanceKm);
  return html`
  <li class="result ${r.mapfre ? 'is-mapfre' : ''}" data-id="${st.id}" tabindex="0">
    <div class="rank">${i + 1}</div>
    <div class="info">
      <div class="title">
        <strong>${st.brand}</strong>
        ${r.mapfre ? html`<span class="badge mapfre" title="${r.rule.name}">🍀 ${pct(r.percent)}</span>` : ''}
        ${openBadge(r)}
        ${st.saleType === 'R' ? html`<span class="badge off">Venta restringida</span>` : ''}
        ${favorite ? html`<span class="star" aria-label="Favorita">★</span>` : ''}
      </div>
      <div class="addr">${st.address} · ${st.locality}</div>
      <div class="meta">${where} · ${litres} L: ${eur(r.totalCost)}${r.detourCost > 0.005 ? html` <span class="muted">(desvío ${eur(r.detourCost)})</span>` : ''}</div>
    </div>
    <div class="price">
      <div class="eff">${eurL(r.effective)}</div>
      ${r.mapfre ? html`<div class="pump">surtidor ${eurL(r.price)}</div>` : html`<div class="pump">sin tréboles</div>`}
    </div>
  </li>`;
}

export function summaryHtml(s, { litres, fuel }) {
  if (!s.count) {
    return html`<div class="empty">No hay gasolineras con ${fuelLabel(fuel)} que cumplan los filtros. Prueba a ampliar el radio o quitar filtros.</div>`;
  }
  const m = s.bestMapfre, o = s.bestNonMapfre;
  let verdict = '';
  if (m && o) {
    const diff = o.price - m.effective; // >0: MAPFRE sale más barata
    verdict = diff >= 0
      ? html`<p class="verdict good">La mejor de Club MAPFRE te sale <b>${eurL(diff)}/L más barata</b> que la mejor sin tréboles (${eur(diff * litres)} en ${litres} L).</p>`
      : html`<p class="verdict bad">Aunque cuentes los tréboles, la mejor sin Club MAPFRE es <b>${eurL(-diff)}/L más barata</b> (${eur(-diff * litres)} en ${litres} L).</p>`;
  } else if (!m) {
    verdict = html`<p class="verdict bad">No hay gasolineras de Club MAPFRE en esta zona con tus reglas actuales. Revisa las marcas en Ajustes o amplía el radio.</p>`;
  }
  const t = s.bestTotal;
  const totalNote = t && s.bestEffective && t.station.id !== s.bestEffective.station.id
    ? html`<p class="small">Contando el desvío (${num2(t.detourKm)} km ida y vuelta), lo que menos te cuesta es <a href="#" data-open="${t.station.id}">${t.station.brand} · ${t.station.address}</a>: ${eur(t.totalCost)} por ${litres} L.</p>`
    : '';
  const card = (r, title, cls) => r
    ? html`<button class="best ${cls}" data-open="${r.station.id}">
        <span class="label">${title}</span>
        <strong>${r.station.brand}</strong>
        <span class="small">${r.station.address}</span>
        <span class="big">${eurL(r.effective)}</span>
        <span class="small">${r.mapfre ? html`surtidor ${eurL(r.price)} · ${pct(r.percent)} en tréboles` : 'precio en surtidor'} · ${km(r.station.offRouteKm ?? r.station.distanceKm)}</span>
      </button>`
    : html`<div class="best ${cls} none"><span class="label">${title}</span><span class="small">Ninguna en la zona</span></div>`;
  return html`
    <div class="best-grid">
      ${card(m, 'Mejor Club MAPFRE', 'mapfre')}
      ${card(o, 'Más barata sin MAPFRE', 'other')}
    </div>
    ${verdict}
    ${totalNote}
    <div class="stats">
      <span><b>${s.count}</b> gasolineras (${s.mapfreCount} Club MAPFRE)</span>
      <span>Mín. <b>${eurL(s.min)}</b></span>
      <span>Media <b>${eurL(s.avg)}</b></span>
      <span>Máx. <b>${eurL(s.max)}</b></span>
    </div>`;
}

function navLinks(st) {
  const ll = `${st.lat},${st.lon}`;
  return html`
    <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${ll}">Google Maps</a>
    <a class="btn" target="_blank" rel="noopener" href="https://waze.com/ul?ll=${ll}&navigate=yes">Waze</a>
    <a class="btn" target="_blank" rel="noopener" href="https://maps.apple.com/?daddr=${ll}">Apple Maps</a>`;
}

export function detailHtml(st, { settings, favorite, fecha, now = new Date() }) {
  const { program, overrides, fuel, litres } = settings;
  const rule = findRule(st, program, overrides);
  const p = percentFor(rule, now);
  const status = openStatus(st.schedule, now);
  const ov = overrides[st.id];
  const price = st.prices[fuel];
  const rows = FUELS.filter((f) => st.prices[f.key] != null).map((f) => {
    const v = st.prices[f.key];
    return html`<tr class="${f.key === fuel ? 'sel' : ''}"><td>${f.label}</td><td>${eurL(v)}</td><td>${rule ? eurL(effectivePrice(v, p, program.trebolValue)) : '—'}</td></tr>`;
  });
  // Carburantes que no están en la lista conocida
  for (const [k, v] of Object.entries(st.prices)) {
    if (!FUELS.some((f) => f.key === k)) rows.push(html`<tr><td>${k}</td><td>${eurL(v)}</td><td>—</td></tr>`);
  }
  return html`
  <form method="dialog" class="sheet-head">
    <div>
      <h2>${st.brand}</h2>
      <p class="small">${st.address}, ${st.postalCode} ${st.locality} (${st.province})</p>
    </div>
    <button class="btn icon" value="close" aria-label="Cerrar">✕</button>
  </form>
  <div class="sheet-body">
    <p><span class="badge ${status.open === true ? 'ok' : status.open === false ? 'off' : ''}">${status.label}</span>
       <span class="small muted">${st.schedule || 'Sin horario publicado'}</span></p>
    ${st.saleType === 'R' ? html`<p class="warn small">Venta restringida: solo para socios o clientes de esta estación (cooperativas, flotas…).</p>` : ''}

    <div class="mapfre-box ${rule ? 'yes' : 'no'}">
      ${rule
        ? html`<p><b>🍀 Club MAPFRE: ${rule.name}</b></p>
               <p>Hoy te devuelve el <b>${pct(p)}</b> en tréboles${price != null ? html`: ${num2(treblesFor(price * litres, p))} tréboles por ${litres} L de ${fuelLabel(fuel)} (${eur(price * litres)})` : ''}.</p>
               <p class="small muted">${rule.requirement ?? ''}</p>`
        : html`<p><b>No consta como adherida a Club MAPFRE</b> con tus reglas actuales.</p>`}
      <div class="row wrap">
        ${ov !== 'in' ? html`<button class="btn small" data-action="mark-in">Marcar como adherida</button>` : ''}
        ${ov !== 'out' && rule ? html`<button class="btn small" data-action="mark-out">Marcar como NO adherida</button>` : ''}
        ${ov ? html`<button class="btn small" data-action="mark-clear">Quitar mi marca</button>` : ''}
      </div>
    </div>

    <table class="prices">
      <thead><tr><th>Carburante</th><th>Surtidor</th><th>Con tréboles</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <h3>Evolución del precio (${fuelLabel(fuel)}, 30 días)</h3>
    <div id="history-chart" class="history"><p class="muted small">Cargando histórico…</p></div>

    <div class="row wrap actions">
      ${raw(navLinks(st).value)}
    </div>
    <div class="row wrap actions">
      <button class="btn" data-action="fav">${favorite ? '★ Quitar de favoritas' : '☆ Añadir a favoritas'}</button>
      <button class="btn primary" data-action="refuel">Registrar repostaje</button>
      <button class="btn" data-action="share">Compartir</button>
    </div>
    <p class="small muted">Precios del Ministerio para la Transición Ecológica · ${fecha ?? ''} · ID ${st.id}</p>
  </div>`;
}
