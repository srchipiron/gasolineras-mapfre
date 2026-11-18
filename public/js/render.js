// Plantillas HTML de resultados, resumen y ficha de la gasolinera.

import { html, raw, eurL, eur, km, num2, pct, date, cents } from './format.js';
import { openStatus } from '/shared/horario.js';
import { FUELS, fuelLabel } from '/shared/fuels.js';
import {
  findRule, percentFor, effectivePrice, treblesFor, fuelEligible, eligibleAmount, isApprox, DEFAULT_PROGRAM,
} from '/shared/treboles.js';
import { provinciaName } from '/shared/provincias.js';

function openBadge(r) {
  if (r.open === true) return html`<span class="badge ok">Abierta</span>`;
  if (r.open === false) return html`<span class="badge off">Cerrada</span>`;
  return '';
}

function mapfreBadge(r) {
  if (!r.adherida) return '';
  if (!r.mapfre) return html`<span class="badge" title="Este carburante no da tréboles">🍀 sin tréboles</span>`;
  return html`<span class="badge mapfre" title="${r.rule.name}">🍀 ${pct(r.percent)}</span>${
    r.approx ? html`<span class="badge approx" title="Solo por la marca: compruébalo en el mapa oficial">aprox.</span>` : ''}`;
}

function changeChip(delta) {
  if (delta == null) return '';
  const cls = delta < 0 ? 'down' : delta > 0 ? 'up' : 'same';
  return html`<span class="chg ${cls}" title="Variación del precio en surtidor desde ayer">${cents(delta)}</span>`;
}

function noteBadges(note) {
  if (!note) return '';
  return html`${note.verdict === 'ok' ? html`<span class="badge ok" title="Te dieron tréboles aquí">✓ tréboles</span>` : ''}${
    note.verdict === 'ko' ? html`<span class="badge off" title="No te dieron tréboles aquí">✗ sin tréboles</span>` : ''}${
    note.note ? html`<span class="note-icon" title="${note.note}">📝</span>` : ''}`;
}

export function resultItem(r, i, { litres, mode = 'nearby', favorite = false, markMode = false, note = null }) {
  const st = r.station;
  const where = mode === 'route'
    ? `km ${Math.round(st.alongKm)} de la ruta · desvío ${km(st.offRouteKm)}`
    : km(st.distanceKm);
  return html`
  <li class="result ${r.mapfre ? 'is-mapfre' : ''} ${r.approx ? 'is-approx' : ''}" data-id="${st.id}" tabindex="0">
    <div class="rank">${i + 1}</div>
    <div class="info">
      <div class="title">
        <strong>${st.brand}</strong>
        ${mapfreBadge(r)}
        ${openBadge(r)}
        ${st.saleType === 'R' ? html`<span class="badge off">Venta restringida</span>` : ''}
        ${favorite ? html`<span class="star" aria-label="Favorita">★</span>` : ''}
        ${noteBadges(note)}
      </div>
      <div class="addr">${st.address} · ${st.locality}</div>
      <div class="meta">${where} · ${litres} L: ${eur(r.totalCost)}${r.detourCost > 0.005 ? html` <span class="muted">(desvío ${eur(r.detourCost)})</span>` : ''}</div>
    </div>
    <div class="price">
      <div class="eff">${eurL(r.effective)}</div>
      ${r.mapfre ? html`<div class="pump">surtidor ${eurL(r.price)}</div>` : html`<div class="pump">sin tréboles</div>`}
      ${r.change ? changeChip(r.change) : ''}
      ${markMode ? html`<button type="button" class="btn small mark ${r.adherida ? 'on' : ''}" data-mark="${st.id}" aria-pressed="${r.adherida}">${r.adherida ? '✓ Adherida' : '＋ Adherida'}</button>` : ''}
    </div>
  </li>`;
}

export function summaryHtml(s, { litres, fuel, program, capLeft = Infinity, onlyMapfre = false, officialCount = 0 }) {
  if (!s.count) {
    if (onlyMapfre && !officialCount) {
      return html`<div class="empty">Todavía no hay gasolineras adheridas cargadas: la app solo muestra las de la <b>lista oficial del mapa de Club MAPFRE</b>.<br>
        <button type="button" class="btn primary small" data-goto="settings">Importar la lista oficial</button>
        <button type="button" class="btn small" data-show-all="1">Ver todas las gasolineras</button></div>`;
    }
    if (onlyMapfre) {
      return html`<div class="empty">Ninguna gasolinera de la lista oficial en esta zona con ${fuelLabel(fuel)} (o con el tipo elegido). Amplía el radio o importa más zonas del mapa oficial.<br>
        <button type="button" class="btn small" data-show-all="1">Ver todas las gasolineras</button></div>`;
    }
    return html`<div class="empty">No hay gasolineras con ${fuelLabel(fuel)} que cumplan los filtros. Prueba a ampliar el radio o quitar filtros.</div>`;
  }
  if (!fuelEligible(program, fuel)) {
    return html`<p class="verdict bad">El ${fuelLabel(fuel)} no da tréboles en Club MAPFRE: la lista está ordenada por precio en surtidor.</p>
      <div class="stats"><span><b>${s.count}</b> gasolineras</span><span>Mín. <b>${eurL(s.min)}</b></span><span>Media <b>${eurL(s.avg)}</b></span><span>Máx. <b>${eurL(s.max)}</b></span></div>`;
  }
  const m = s.bestMapfre, o = s.bestNonMapfre;
  let verdict = '';
  if (m && o) {
    const diff = o.price - m.effective; // >0: MAPFRE sale más barata
    verdict = diff >= 0
      ? html`<p class="verdict good">La mejor de Club MAPFRE te sale <b>${eurL(diff)}/L más barata</b> que la mejor sin tréboles (${eur(diff * litres)} en ${litres} L).</p>`
      : html`<p class="verdict bad">Aunque cuentes los tréboles, la mejor sin Club MAPFRE es <b>${eurL(-diff)}/L más barata</b> (${eur(-diff * litres)} en ${litres} L).</p>`;
  } else if (!m) {
    verdict = html`<p class="verdict bad">No hay gasolineras de Club MAPFRE en esta zona. Amplía el radio o revisa la lista de adheridas en Ajustes.</p>`;
  }
  const t = s.bestTotal;
  const totalNote = t && s.bestEffective && t.station.id !== s.bestEffective.station.id
    ? html`<p class="small">Contando el desvío (${num2(t.detourKm)} km ida y vuelta), lo que menos te cuesta es <a href="#" data-open="${t.station.id}">${t.station.brand} · ${t.station.address}</a>: ${eur(t.totalCost)} por ${litres} L.</p>`
    : '';
  const card = (r, title, cls) => r
    ? html`<button class="best ${cls}" data-open="${r.station.id}">
        <span class="label">${title}${r.approx ? ' (aprox.)' : ''}</span>
        <strong>${r.station.brand}</strong>
        <span class="small">${r.station.address}</span>
        <span class="big">${eurL(r.effective)}</span>
        <span class="small">${r.mapfre ? html`surtidor ${eurL(r.price)} · ${pct(r.percent)} en tréboles` : 'precio en surtidor'} · ${km(r.station.offRouteKm ?? r.station.distanceKm)}</span>
      </button>`
    : html`<div class="best ${cls} none"><span class="label">${title}</span><span class="small">Ninguna en la zona</span></div>`;
  return html`
    <div class="best-grid ${onlyMapfre ? 'single' : ''}">
      ${card(m, 'Mejor Club MAPFRE', 'mapfre')}
      ${onlyMapfre ? '' : card(o, 'Más barata sin MAPFRE', 'other')}
    </div>
    ${onlyMapfre ? '' : verdict}
    ${totalNote}
    ${Number.isFinite(capLeft) && m && capLeft < m.price * litres
      ? html`<p class="small warn">Hoy solo te quedan ${eur(capLeft)} con tréboles por el tope de 100 € al día y 300 € a la semana: los precios con tréboles ya lo tienen en cuenta.</p>`
      : ''}
    <div class="stats">
      <span><b>${s.count}</b> gasolineras (${s.mapfreCount} Club MAPFRE)</span>
      <span>Mín. <b>${eurL(s.min)}</b></span>
      <span>Media <b>${eurL(s.avg)}</b></span>
      <span>Máx. <b>${eurL(s.max)}</b></span>
      ${s.avgChange != null ? html`<span>Desde ayer ${changeChip(s.avgChange)} <span class="muted">(${s.changedDown} bajan, ${s.changedUp} suben)</span></span>` : ''}
    </div>`;
}

/** Tarjeta «¿reposto hoy o espero al 6 %?». */
export function adviceHtml(a, { litres }) {
  if (!a || a.extra <= 0) return '';
  if (a.boostNow) {
    return html`<div class="advice on">🍀 <b>Hoy es día de ${a.percent} %</b>${a.daysLeft > 1 ? html` (quedan ${a.daysLeft} días)` : ' (último día)'}: si te toca repostar este mes, hazlo ahora. Con ${litres} L ganas ${eur(a.extra)} más en tréboles que el resto del mes.</div>`;
  }
  return html`<div class="advice">📅 <b>¿Puedes esperar ${a.days} ${a.days === 1 ? 'día' : 'días'}?</b> El ${date(a.nextBoost)} vuelve el ${a.percent} %: con ${litres} L ganarías ${eur(a.extra)} más en tréboles, si los precios no cambian.
    <button type="button" class="btn small" data-action="ics">Recordármelo en el calendario</button></div>`;
}

function navLinks(st) {
  const ll = `${st.lat},${st.lon}`;
  return html`
    <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${ll}">Google Maps</a>
    <a class="btn" target="_blank" rel="noopener" href="https://waze.com/ul?ll=${ll}&navigate=yes">Waze</a>
    <a class="btn" target="_blank" rel="noopener" href="https://maps.apple.com/?daddr=${ll}">Apple Maps</a>`;
}

const SOURCE_TEXT = {
  official: 'Está en la lista oficial del mapa de Club MAPFRE.',
  brand: 'Por la marca, según las condiciones publicadas.',
  approx: 'Por la marca, sin confirmar: compruébalo en el mapa oficial o con «Tu experiencia».',
  manual: 'La has marcado tú como adherida.',
};

export function detailHtml(st, { settings, official, favorite, fecha, note = null, capLeft = Infinity, now = new Date() }) {
  const { program, overrides, fuel, litres } = settings;
  const rule = findRule(st, program, overrides, official);
  const p = percentFor(rule, now);
  const status = openStatus(st.schedule, now);
  const ov = overrides[st.id];
  const price = st.prices[fuel];
  const eligible = fuelEligible(program, fuel);
  const rows = FUELS.filter((f) => st.prices[f.key] != null).map((f) => {
    const v = st.prices[f.key];
    const withT = rule && fuelEligible(program, f.key)
      ? eurL(effectivePrice(v, p, program.trebolValue, { amountEur: v * litres, program }))
      : '—';
    const prev = st.prev?.[f.key];
    return html`<tr class="${f.key === fuel ? 'sel' : ''}"><td>${f.label}</td><td>${eurL(v)} ${prev != null ? changeChip(Math.round((v - prev) * 1000) / 1000) : ''}</td><td>${withT}</td></tr>`;
  });
  // Carburantes que no están en la lista conocida
  for (const [k, v] of Object.entries(st.prices)) {
    if (!FUELS.some((f) => f.key === k)) rows.push(html`<tr><td>${k}</td><td>${eurL(v)}</td><td>—</td></tr>`);
  }
  const covered = official?.provinces?.includes(st.idProvincia);
  const amount = price != null ? price * litres : 0;
  const capped = rule?.noCap ? amount : Math.max(0, Math.min(eligibleAmount(amount, program), capLeft));
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

    <div class="mapfre-box ${rule ? 'yes' : 'no'} ${rule?.source === 'brand' ? 'approx' : ''}">
      ${rule
        ? html`<p><b>🍀 Club MAPFRE: ${rule.name}</b></p>
               <p class="small">${isApprox(rule) ? SOURCE_TEXT.approx : SOURCE_TEXT[rule.source] ?? ''}</p>
               ${rule.ventajas ? html`<p class="small">Ventaja según el mapa oficial: <b>${rule.ventajas}</b></p>` : ''}
               ${eligible && price != null
                 ? html`<p>Hoy te devuelve el <b>${pct(p)}</b> en tréboles: ${num2(treblesFor(capped, p))} tréboles por ${litres} L de ${fuelLabel(fuel)} (${eur(amount)})${capped < amount ? html` <span class="small">— solo cuentan ${eur(capped)} por el tope de 100 €/día y 300 €/semana</span>` : ''}.</p>`
                 : html`<p class="warn small">El ${fuelLabel(fuel)} no da tréboles (el GLP y el GNC están excluidos).</p>`}
               <p class="small muted">${rule.requirement ?? program.requirement ?? DEFAULT_PROGRAM.requirement}</p>`
        : html`<p><b>No consta como adherida a Club MAPFRE</b>${covered ? html` en la lista oficial de ${provinciaName(st.idProvincia)}` : ' con tus reglas actuales'}.</p>`}
      <div class="row wrap">
        ${ov !== 'in' && !rule ? html`<button class="btn small" data-action="mark-in">Marcar como adherida</button>` : ''}
        ${ov !== 'out' && rule ? html`<button class="btn small" data-action="mark-out">Marcar como NO adherida</button>` : ''}
        ${ov ? html`<button class="btn small" data-action="mark-clear">Quitar mi marca</button>` : ''}
        <a class="btn small" target="_blank" rel="noopener" href="${program.officialMapUrl ?? DEFAULT_PROGRAM.officialMapUrl}">Ver mapa oficial ↗</a>
      </div>
    </div>

    <div class="experience">
      <p><b>Tu experiencia aquí</b>${note?.date ? html` <span class="small muted">(${date(note.date)})</span>` : ''}</p>
      <div class="row wrap">
        <button class="btn small ${note?.verdict === 'ok' ? 'sel-ok' : ''}" data-action="verdict-ok" aria-pressed="${note?.verdict === 'ok'}">✓ Me dieron tréboles</button>
        <button class="btn small ${note?.verdict === 'ko' ? 'sel-ko' : ''}" data-action="verdict-ko" aria-pressed="${note?.verdict === 'ko'}">✗ No me los dieron</button>
      </div>
      <label class="field"><span>Nota (solo la ves tú)</span>
        <textarea id="station-note" rows="2" maxlength="500" placeholder="Ej.: piden el carnet físico, el QR no funciona…">${note?.note ?? ''}</textarea></label>
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
