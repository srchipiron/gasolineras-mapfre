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

/** Columna de precio en el coche de empresa: lo que importa son tus tréboles. */
function companyPrice(r) {
  return r.treboles > 0
    ? html`<div class="gain">+${num2(r.treboles)} 🍀</div><div class="pump">surtidor ${eurL(r.price)}</div>`
    : html`<div class="gain none">0 🍀</div><div class="pump">surtidor ${eurL(r.price)}</div>`;
}

export function resultItem(r, i, { litres, mode = 'nearby', favorite = false, markMode = false, note = null, company = false }) {
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
      <div class="meta">${company
        ? html`${where} · ${litres} L: la empresa paga ${eur(r.pumpCost)}`
        : html`${where} · ${litres} L: ${eur(r.totalCost)}${r.detourCost > 0.005 ? html` <span class="muted">(desvío ${eur(r.detourCost)})</span>` : ''}`}</div>
    </div>
    <div class="price">
      ${company ? companyPrice(r) : html`<div class="eff">${eurL(r.effective)}</div>
      ${r.mapfre ? html`<div class="pump">surtidor ${eurL(r.price)}</div>` : html`<div class="pump">sin tréboles</div>`}`}
      ${r.change ? changeChip(r.change) : ''}
      ${markMode ? html`<button type="button" class="btn small mark ${r.adherida ? 'on' : ''}" data-mark="${st.id}" aria-pressed="${r.adherida}">${r.adherida ? '✓ Adherida' : '＋ Adherida'}</button>` : ''}
    </div>
  </li>`;
}

const FILTER_TITLES = {
  all: ['Mejor Club MAPFRE', 'Mejor sin Club MAPFRE'],
  colaboradora: ['Mejor «Más EESS colaboradoras»', 'Mejor fuera del filtro'],
  repsol: ['Mejor «Gasolinera Repsol»', 'Mejor fuera del filtro'],
};

/** Estadísticas de la lista: cuántas, la más barata (con su nombre), media, máximo y cambio desde ayer. */
function statsHtml(s) {
  return html`<div class="stats">
      <span><b>${s.count}</b> en la lista</span>
      <span>Mín. <b>${eurL(s.min)}</b>${s.cheapestPump ? html` <button type="button" class="link" data-open="${s.cheapestPump.station.id}">${s.cheapestPump.station.brand}</button>` : ''}</span>
      <span>Media <b>${eurL(s.avg)}</b></span>
      <span>Máx. <b>${eurL(s.max)}</b></span>
      ${s.avgChange != null ? html`<span>Desde ayer ${changeChip(s.avgChange)} <span class="muted">(${s.changedDown} bajan, ${s.changedUp} suben)</span></span>` : ''}
    </div>`;
}

export function summaryHtml(s, {
  litres, fuel, program, capLeft = Infinity, onlyMapfre = false, officialCount = 0, comparison = null, tipo = 'all', radiusKm = null,
  company = false, companyCmp = null,
}) {
  if (!fuelEligible(program, fuel)) {
    return html`<p class="verdict bad">El ${fuelLabel(fuel)} no da tréboles en Club MAPFRE: la lista está ordenada por precio en surtidor.</p>
      ${s.count ? html`<div class="stats"><span><b>${s.count}</b> gasolineras</span><span>Mín. <b>${eurL(s.min)}</b></span><span>Media <b>${eurL(s.avg)}</b></span><span>Máx. <b>${eurL(s.max)}</b></span></div>` : ''}`;
  }
  if (!officialCount) {
    return html`<div class="empty">Todavía no hay gasolineras adheridas cargadas: la app solo cuenta las de la <b>lista oficial del mapa de Club MAPFRE</b>.<br>
      <button type="button" class="btn primary small" data-goto="settings">Importar la lista oficial</button>
      ${onlyMapfre ? html`<button type="button" class="btn small" data-show-all="1">Ver todas las gasolineras</button>` : ''}</div>
      ${s.count ? statsHtml(s) : ''}`;
  }
  const tv = program?.trebolValue ?? 1;
  if (company) return companySummaryHtml(s, { litres, fuel, capLeft, onlyMapfre, cmp: companyCmp ?? {}, tv, radiusKm });
  const c = comparison ?? {};
  const [inTitle, outTitle] = FILTER_TITLES[tipo] ?? FILTER_TITLES.all;
  const card = (r, title, cls) => r
    ? html`<button class="best ${cls}" data-open="${r.station.id}">
        <span class="label">${title}</span>
        <strong>${r.station.brand}</strong>
        <span class="small">${r.station.address} · ${km(r.station.offRouteKm ?? r.station.distanceKm)}</span>
        <span class="big">${eurL(r.effective)}</span>
        <span class="small">${r.mapfre ? html`surtidor ${eurL(r.price)} · ${pct(r.percent)} en tréboles` : 'precio en surtidor, sin tréboles'}</span>
        <span class="small cost">Coste real: <b>${eur(r.totalCost)}</b>${r.detourCost > 0.005 ? html` (desvío ${eur(r.detourCost)})` : ''}</span>
      </button>`
    : html`<div class="best ${cls} none"><span class="label">${title}</span><span class="small">Ninguna en la zona</span></div>`;

  let verdict = '';
  const i = c.bestIn, o = c.bestOut;
  if (i && o) {
    const tre = i.treboles * tv;
    verdict = c.saving >= 0
      ? html`<p class="verdict good">✅ <b>Te merecen la pena los tréboles:</b> en ${i.station.brand} pagas <b>${eur(i.totalCost)}</b> por ${litres} L
          (con ${eur(tre)} en tréboles ya descontados y el desvío incluido) frente a ${eur(o.totalCost)} en ${o.station.brand}. <b>Ahorras ${eur(c.saving)}.</b></p>`
      : html`<p class="verdict bad">❌ <b>No te merecen la pena:</b> ${o.station.brand} te sale <b>${eur(-c.saving)} más barata</b> que ${i.station.brand}
          aunque cuentes sus ${eur(tre)} en tréboles (${eur(o.totalCost)} frente a ${eur(i.totalCost)}, desvío incluido).</p>`;
  } else if (!i) {
    verdict = html`<p class="verdict bad">No hay ninguna gasolinera del filtro en ${radiusKm ? html`${km(radiusKm)} a la redonda` : 'esta zona'}: amplía el radio o cambia el filtro.</p>`;
  } else if (!o) {
    verdict = html`<p class="small muted">Todas las gasolineras de la zona están en el filtro: no hay con qué comparar.</p>`;
  }
  return html`
    <div class="best-grid">
      ${card(i, inTitle, 'mapfre')}
      ${card(o, outTitle, 'other')}
    </div>
    ${verdict}
    <p class="small muted">Coste real = ${litres} L al precio con tréboles + el combustible de ir y volver a la gasolinera. Cambia los litros y el consumo en Ajustes → Tus vehículos.</p>
    ${Number.isFinite(capLeft) && i && !i.rule?.noCap && capLeft < i.price * litres
      ? html`<p class="small warn">Hoy solo te quedan ${eur(capLeft)} con tréboles por el tope de 100 € al día y 300 € a la semana: los precios con tréboles ya lo tienen en cuenta.</p>`
      : ''}
    ${s.count ? statsHtml(s) : html`<div class="empty">Ninguna gasolinera de la lista oficial en esta zona con ${fuelLabel(fuel)} (o con el tipo elegido).
      ${onlyMapfre ? html`<button type="button" class="btn small" data-show-all="1">Ver todas las gasolineras</button>` : ''}</div>`}`;
}

/**
 * Resumen en el coche de empresa: el carburante no sale de tu bolsillo, así
 * que la mejor para ti es la que más tréboles te da. Se enseña también cuánto
 * le cuesta a la empresa frente a la más barata, para no pasarse.
 */
function companySummaryHtml(s, { litres, fuel, capLeft, onlyMapfre, cmp, tv, radiusKm }) {
  const b = cmp.best, ch = cmp.cheapest;
  const card = (r, title, cls, big, line) => r
    ? html`<button class="best ${cls}" data-open="${r.station.id}">
        <span class="label">${title}</span>
        <strong>${r.station.brand}</strong>
        <span class="small">${r.station.address} · ${km(r.station.offRouteKm ?? r.station.distanceKm)}</span>
        <span class="big">${big}</span>
        <span class="small">${line}</span>
      </button>`
    : html`<div class="best ${cls} none"><span class="label">${title}</span><span class="small">Ninguna en la zona</span></div>`;
  let verdict;
  if (b) {
    const extra = cmp.extraForCompany ?? 0;
    verdict = html`<p class="verdict good">💼 <b>Paga la empresa:</b> reposta en ${b.station.brand} y te llevas <b>${num2(b.treboles)} tréboles</b>
      (${eur(b.treboles * tv)} de descuento en tu seguro) sin poner un euro.
      ${extra > 0.005 && ch
        ? html`A la empresa le cuesta ${eur(extra)} más que ${ch.station.brand} (${eur(b.pumpCost)} frente a ${eur(ch.pumpCost)}, desvío incluido).`
        : 'Además es la que menos le cuesta a la empresa.'}</p>`;
  } else {
    verdict = html`<p class="verdict bad">No hay ninguna adherida que dé tréboles en ${radiusKm ? html`${km(radiusKm)} a la redonda` : 'esta zona'}: hoy no ganas nada. Amplía el radio o ve a la que te venga mejor.</p>`;
  }
  return html`
    <div class="best-grid">
      ${card(b, 'Mejor para ti (más tréboles)', 'mapfre', b ? `+${num2(b.treboles)} 🍀` : '', b ? html`surtidor ${eurL(b.price)} · ${pct(b.percent)} en tréboles` : '')}
      ${card(ch, 'Más barata para la empresa', 'other', ch ? eurL(ch.price) : '', ch ? (ch.treboles > 0 ? html`+${num2(ch.treboles)} tréboles para ti` : 'sin tréboles para ti') : '')}
    </div>
    ${verdict}
    <p class="small muted">Coche de empresa: el carburante no sale de tu bolsillo. La lista pone primero las que más tréboles te dan y, entre iguales, la que menos le cuesta a la empresa (${litres} L más el desvío).</p>
    ${Number.isFinite(capLeft) && b && !b.rule?.noCap && capLeft < b.price * litres
      ? html`<p class="small warn">El tope de 100 € al día y 300 € a la semana es de tu carnet, también con el coche de empresa: hoy solo te quedan ${eur(capLeft)} con tréboles.</p>`
      : ''}
    ${s.count ? statsHtml(s) : html`<div class="empty">Ninguna gasolinera en esta zona con ${fuelLabel(fuel)}.
      ${onlyMapfre ? html`<button type="button" class="btn small" data-show-all="1">Ver todas las gasolineras</button>` : ''}</div>`}`;
}

/**
 * Tarjeta «Te aconsejo»: una sola gasolinera, la mejor para ti según el modo,
 * con el porqué en una frase y botones para verla o ir.
 */
export function recommendHtml(rec, { litres, tv = 1, route = false } = {}) {
  if (!rec?.best) return '';
  const b = rec.best;
  const st = b.station;
  const where = route
    ? `km ${Math.round(st.alongKm ?? 0)} de la ruta · desvío ${km(st.offRouteKm ?? 0)}`
    : km(st.distanceKm ?? 0);
  let why;
  if (rec.company) {
    why = b.treboles > 0
      ? html`Paga la empresa y tú te llevas <b>${num2(b.treboles)} tréboles</b> (${eur(b.treboles * tv)}) con ${litres} L.
        ${rec.extraForCompany > 0.005
          ? html`A la empresa le cuesta ${eur(rec.extraForCompany)} más que la más barata (${rec.cheapestForCompany.station.brand}).`
          : 'Y es la que menos le cuesta a la empresa.'}`
      : html`Ninguna abierta da tréboles por aquí: esta es la que menos le cuesta a la empresa (${eur(b.pumpCost)} con ${litres} L).`;
  } else {
    const nearestIsBest = rec.nearest.station.id === st.id;
    const rv = rec.rival;
    // Tréboles sí o no: lo que de verdad te ahorras frente a la mejor del otro lado.
    const vsTreboles = rv && rec.savingVsRival > 0.005
      ? (b.treboles > 0
        ? html`<b>Con tréboles compensa:</b> te ahorras ${eur(rec.savingVsRival)} frente a la mejor sin tréboles (${rv.station.brand}, ${eur(rv.totalCost)}).`
        : html`<b>Aquí no hay tréboles, pero no te compensan:</b> aunque cuentes los ${eur(rv.treboles * tv)} en tréboles de ${rv.station.brand}, allí pagarías ${eur(rv.totalCost)}. Te ahorras <b>${eur(rec.savingVsRival)}</b>.`)
      : '';
    why = html`Te cuesta <b>${eur(b.totalCost)}</b> con ${litres} L${b.treboles > 0 ? html`, con ${eur(b.treboles * tv)} en tréboles ya descontados` : ''}${
      b.detourCost > 0.005 ? html` y el desvío incluido` : ''}.
      ${vsTreboles}
      ${nearestIsBest
        ? 'Además es la más cercana.'
        : rec.savingVsNearest > 0.005
          ? html`Ahorras <b>${eur(rec.savingVsNearest)}</b> frente a la más cercana (${rec.nearest.station.brand}, ${km(rec.nearest.station.offRouteKm ?? rec.nearest.station.distanceKm)}).`
          : ''}
      ${rec.savingVsNext != null && rec.savingVsNext < 0.3 && rec.next ? html`<span class="muted">${rec.next.station.brand} sale casi igual (${eur(rec.savingVsNext)} más).</span>` : ''}`;
  }
  return html`
  <div class="advise ${rec.company ? 'company' : ''}">
    <span class="label">${rec.company ? '💼 Te aconsejo (coche de empresa)' : '🚗 Te aconsejo (tu coche)'}</span>
    <button type="button" class="advise-main" data-open="${st.id}">
      <strong>${b.mapfre ? '🍀 ' : ''}${st.brand}</strong>
      <span class="small">${st.address} · ${st.locality ?? ''} · ${where}${b.open === true ? ' · abierta' : ''}</span>
      <span class="big">${rec.company && b.treboles > 0 ? `+${num2(b.treboles)} 🍀` : eurL(rec.company ? b.price : b.effective)}</span>
    </button>
    <p class="small">${why}</p>
    <div class="row wrap">
      <button type="button" class="btn small" data-open="${st.id}">Ver ficha</button>
      <a class="btn small primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${st.lat},${st.lon}">Cómo llegar</a>
    </div>
  </div>`;
}

/** Tarjeta «La más barata de cada marca». */
export function brandsHtml(groups, { open = false, max = 6 } = {}) {
  if (groups.length < 2) return '';
  const row = (g) => {
    const r = g.best;
    return html`<li><button type="button" class="brand-row ${r.mapfre ? 'is-mapfre' : ''}" data-open="${r.station.id}">
      <span class="brand-name"><span class="brand-title">${r.mapfre ? '🍀 ' : ''}<b>${g.brand}</b></span>
        <span class="brand-meta muted small">${g.count === 1 ? '1 gasolinera' : `${g.count} gasolineras · la más barata`} a ${km(r.station.offRouteKm ?? r.station.distanceKm)}${r.station.offRouteKm != null ? ' de la ruta' : ''}</span></span>
      <span class="brand-price">${eurL(r.effective)}</span>
    </button></li>`;
  };
  const first = groups.slice(0, max);
  const rest = groups.slice(max);
  return html`
  <details class="brands" ${open ? 'open' : ''}>
    <summary>🏷️ <b>La más barata de cada marca</b> <span class="muted small">(${groups.length} marcas)</span></summary>
    <ol>${first.map(row)}</ol>
    ${rest.length ? html`<details class="brands-more"><summary class="small">Ver ${rest.length} marcas más</summary><ol>${rest.map(row)}</ol></details>` : ''}
    <p class="muted small">Precio con tréboles en las adheridas 🍀 y precio en surtidor en las demás.</p>
  </details>`;
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
        ${rule ? html`<button class="btn small primary" data-action="card">🪪 Enseñar carnet</button>` : ''}
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
