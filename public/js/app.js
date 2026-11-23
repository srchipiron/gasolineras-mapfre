// Aplicación principal: búsqueda, mapa, lista y pestañas.

import { api } from './api.js';
import { createMap } from './map.js';
import { html, eurL, eur, km, duration, todayISO, date, parseFecha } from './format.js';
import { resultItem, summaryHtml, detailHtml, adviceHtml, brandsHtml, recommendHtml } from './render.js';
import { lineChart } from './chart.js';
import {
  loadSettings, saveSettings, loadFavorites, loadLog, isFavorite, toggleFavorite, loadLocalOfficial, loadNotes, saveNotes,
  loadLastNearby, saveLastNearby, loadTracks, saveTracks, newId,
} from './store.js';
import { parseTrack } from '/shared/track.js';
import { planStops, locateOnRoute, routeProgress } from '/shared/plan.js';
import { cumulativeKm } from '/shared/geo.js';
import { renderFavorites, renderFavStrip, checkAlerts } from './views/favorites.js';
import { renderTrend } from './views/trend.js';
import { setupInstallBanner, onInstallChange } from './install.js';
import { renderLog, exportLogCsv } from './views/log.js';
import { renderSettings, importEntries } from './views/settings.js';
import { openRefuel } from './views/refuel.js';
import { openCard } from './views/card.js';
import {
  enrich, filterResults, sortResults, summarize, compareFilter, compareCompany, recommend, byBrand, SORTS, COMPANY_SORTS, OFFICIAL_FILTERS,
} from '/shared/ranking.js';
import { MODES, isCompany, sortKey, routeSortKey, routeSorts, switchMode } from '/shared/modo.js';
import { FUELS, fuelLabel } from '/shared/fuels.js';
import {
  isBoostDay, percentFor, daysUntilBoost, programExpired, activePromos, combineOfficial, emptyOfficial, DEFAULT_PROGRAM,
  capStatus, waitAdvice, fuelEligible,
} from '/shared/treboles.js';
import { boostReminderIcs } from '/shared/ics.js';
import { selectVehicle, syncActiveVehicle } from '/shared/vehiculos.js';

const $ = (sel, el = document) => el.querySelector(sel);
const DEFAULT_CENTER = { lat: 40.4168, lon: -3.7038, label: 'Madrid (ubicación por defecto)' };

const state = {
  settings: loadSettings(),
  favorites: loadFavorites(),
  log: loadLog(),
  notes: loadNotes(),
  status: null,
  serverOfficial: emptyOfficial(), // config/adheridas.json del servidor
  localOfficial: loadLocalOfficial(), // importada en este dispositivo
  official: null, // unión de las dos
  pendingMarks: new Map(),
  center: null,
  nearby: null, // respuesta de /api/stations
  nearbyKey: null, // búsqueda a la que corresponde nearby
  staleSince: null, // si nearby es la lista guardada de otra vez, cuándo se guardó
  route: null, // respuesta de /api/route (o /api/track) + etiquetas
  tracks: loadTracks(), // rutas propias (GPX/KML)
  plan: null, // último plan de repostaje calculado en la ruta
  planFromStart: false, // ignorar el último llenado y planificar desde el km 0
  progress: null, // dónde estás en la ruta abierta: { lat, lon, km, offKm, at }
  tab: 'results',
  computed: { nearby: [], route: [] },
};

// ---------------------------------------------------------------- utilidades
let toastTimer;
function toast(msg, ms = 3500) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

const persist = () => saveSettings(state.settings);

/** Gasolineras que cuentan como adheridas (tipos elegidos + marcas a mano). */
function countableOfficial() {
  const types = state.settings.program.officialTypes ?? ['colaboradora'];
  const list = Object.values(state.official?.stations ?? {}).filter((v) => v.tipo === 'manual' || types.includes(v.tipo)).length;
  return list + Object.values(state.settings.overrides).filter((v) => v === 'in').length;
}

/** Euros que aún dan tréboles hoy según tus repostajes registrados. */
const capLeftToday = () => capStatus(todayISO(), state.log, state.settings.program).left;

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadReminder() {
  const p = state.settings.program;
  const rule = p.official ?? DEFAULT_PROGRAM.official;
  const a = waitAdvice({ price: 1, litres: 1, program: p });
  const startISO = a.boostNow ? todayISO(new Date(new Date().getFullYear(), new Date().getMonth(), rule.boostFromDay)) : a.nextBoost;
  download('dias-6-por-ciento-treboles.ics', boostReminderIcs({
    startISO, fromDay: rule.boostFromDay, toDay: rule.boostToDay, percent: rule.boostPercent,
  }), 'text/calendar;charset=utf-8');
  toast('Abre el fichero para añadir el recordatorio a tu calendario 📅');
}

/** Guarda tu experiencia en una gasolinera y la usa como marca de adherida. */
function setVerdict(st, verdict) {
  const prev = state.notes[st.id] ?? {};
  const next = { ...prev, verdict: prev.verdict === verdict ? null : verdict, date: todayISO() };
  state.notes = { ...state.notes, [st.id]: next };
  saveNotes(state.notes);
  const s = state.settings;
  if (next.verdict === 'ok') s.overrides[st.id] = 'in';
  else if (next.verdict === 'ko') s.overrides[st.id] = 'out';
  persist();
  recompute();
}

function computeList(stations, sort) {
  const s = state.settings;
  const enriched = enrich(stations, {
    fuel: s.fuel, program: s.program, overrides: s.overrides, official: state.official, litres: s.litres, consumption: s.consumption,
    capLeft: capLeftToday(),
  });
  // Todas las gasolineras (para comparar) y las que se ven en la lista.
  const all = filterResults(enriched, { openNow: s.openNow, hideRestricted: s.hideRestricted });
  const tipo = s.officialFilter ?? 'all';
  const filtered = filterResults(all, { onlyMapfre: s.onlyMapfre, tipo, hideRestricted: false });
  return {
    results: sortResults(filtered, sort),
    summary: summarize(filtered),
    comparison: compareFilter(all, { tipo }),
    companyCmp: isCompany(s) ? compareCompany(all, { tipo }) : null,
    // La que te aconseja la app: entre todas (no solo las del filtro).
    recommendation: recommend(all, { company: isCompany(s), tipo }),
    all,
  };
}

/** Opciones comunes del resumen (cambian con el modo mi coche / empresa). */
function summaryOpts(comparison, companyCmp, extra = {}) {
  const s = state.settings;
  return {
    litres: s.litres, fuel: s.fuel, program: s.program, capLeft: capLeftToday(),
    onlyMapfre: s.onlyMapfre, officialCount: countableOfficial(), comparison, tipo: s.officialFilter ?? 'all',
    company: isCompany(s), companyCmp, ...extra,
  };
}

function renderList(el, results, mode) {
  const s = state.settings;
  const shown = results.slice(0, 150);
  el.innerHTML = html`${shown.map((r, i) => resultItem(r, i, { litres: s.litres, mode, markMode: s.markMode, company: isCompany(s), favorite: isFavorite(state.favorites, r.station.id), note: state.notes[r.station.id] }))}${
    results.length > shown.length ? html`<li class="muted small more">Y ${results.length - shown.length} más… acerca el mapa o reduce el radio.</li>` : ''}`;
}

function bindOpeners(root, results) {
  const byId = new Map(results.map((r) => [r.station.id, r]));
  root.querySelectorAll('[data-mark]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = byId.get(b.dataset.mark);
      if (r) toggleMark(r);
    }),
  );
  root.querySelectorAll('[data-id]').forEach((li) => {
    const open = () => {
      const r = byId.get(li.dataset.id);
      if (r) { map.focus(r.station.id); openDetail(r.station); }
    };
    li.addEventListener('click', open);
    li.addEventListener('keydown', (e) => e.key === 'Enter' && open());
  });
}

function bindSummaryLinks(root, results) {
  root.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.goto)));
  root.querySelectorAll('[data-show-all]').forEach((b) =>
    b.addEventListener('click', () => {
      state.settings.onlyMapfre = false;
      $('#only-mapfre').checked = false;
      persist();
      recompute();
    }),
  );
  root.querySelectorAll('[data-open]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const r = results.find((x) => x.station.id === el.dataset.open);
      if (r) { map.focus(r.station.id); openDetail(r.station); }
    }),
  );
}

// ---------------------------------------------------------------- recalcular y pintar
function recompute({ fit = false } = {}) {
  const s = state.settings;
  if (state.nearby) {
    const { results, summary, comparison, companyCmp, recommendation, all } = computeList(state.nearby.stations, s[sortKey(s)]);
    state.computed.nearby = results;
    summary.recommended = recommendation?.best ?? null; // se destaca en el mapa
    $('#summary').innerHTML = recommendHtml(recommendation, { litres: s.litres, tv: s.program.trebolValue ?? 1 })
      + summaryHtml(summary, summaryOpts(comparison, companyCmp, { radiusKm: state.nearby.radiusKm }));
    renderAdvice(summary);
    renderFreshness();
    renderTrend(ctx);
    renderFavStrip(ctx);
    renderList($('#results'), results, 'nearby');
    bindOpeners($('#results'), results);
    bindSummaryLinks($('#summary'), all);
    renderBrands($('#brands'), results);
    if (state.tab !== 'route') {
      map.showResults(results, summary, { center: state.nearby.center, radiusKm: state.nearby.radiusKm, fit });
    }
  }
  if (state.route) renderRoute({ fit: false });
}

function renderAdvice(summary) {
  const s = state.settings;
  const el = $('#advice');
  const price = summary.bestMapfre?.price ?? summary.median;
  if (!summary.count || !price || !fuelEligible(s.program, s.fuel)) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = adviceHtml(waitAdvice({ price, litres: s.litres, program: s.program }), { litres: s.litres });
  el.querySelector('[data-action=ics]')?.addEventListener('click', downloadReminder);
}

/** Tarjeta «La más barata de cada marca» (recuerda si la dejaste plegada). */
function renderBrands(el, results) {
  el.innerHTML = brandsHtml(byBrand(results), { open: state.settings.brandsOpen !== false });
  bindSummaryLinks(el, results);
  el.querySelector('details.brands')?.addEventListener('toggle', (e) => {
    if (e.target.classList.contains('brands')) { state.settings.brandsOpen = e.target.open; persist(); }
  });
}

/** Gasto en carburante del viaje con el consumo del vehículo en uso. */
function tripCostHtml(distanceKm, summary) {
  const s = state.settings;
  // Al precio de la gasolinera que te aconseja la app (según el modo).
  const best = summary.recommended ?? summary.bestMapfre ?? summary.bestEffective;
  if (!distanceKm || !s.consumption || !best) return '';
  const litres = (distanceKm * s.consumption) / 100;
  const v = s.vehicles?.find((x) => x.id === s.vehicleId);
  if (isCompany(s)) {
    // La empresa paga el surtidor; los tréboles del repostaje son tuyos.
    const cost = litres * best.price;
    return html`<p class="trip-cost small">💼 <b>Gasto del viaje (lo paga la empresa)</b>${v ? ` (${v.icon} ${v.name}, ${String(s.consumption).replace('.', ',')} L/100 km)` : ''}:
      unos ${Math.round(litres)} L de ${fuelLabel(s.fuel)} ≈ <b>${eur(cost)}</b> en ${best.station.brand} · ida y vuelta ${eur(cost * 2)}.
      ${best.treboles > 0 ? `Tú te llevas unos ${eur(cost * best.percent / 100 * (s.program.trebolValue ?? 1))} en tréboles.` : ''}</p>`;
  }
  const cost = litres * best.effective;
  return html`<p class="trip-cost small">⛽ <b>Gasto del viaje</b>${v ? ` (${v.icon} ${v.name}, ${String(s.consumption).replace('.', ',')} L/100 km)` : ''}:
    unos ${Math.round(litres)} L de ${fuelLabel(s.fuel)} ≈ <b>${eur(cost)}</b> al precio de ${best.station.brand}${best.treboles > 0 ? ' con tréboles' : ''}
    · ${eur(litres * summary.avg)} a precio medio de la ruta · ida y vuelta ${eur(cost * 2)}.</p>`;
}

/**
 * Desde dónde se planifica. En las rutas siempre se sale con el depósito
 * lleno: desde el inicio o, si hoy has llenado en una gasolinera de la ruta,
 * desde ahí.
 */
function planStart(r) {
  if (!state.planFromStart) {
    const fill = state.log.find((e) => e.stationId && e.date === todayISO());
    const st = fill && r.stations.find((x) => x.id === fill.stationId);
    if (st) {
      return {
        startKm: st.alongKm ?? 0, startOffKm: st.offRouteKm ?? 0, entryId: fill.id,
        text: `Has llenado hoy en ${st.brand} (km ${Math.round(st.alongKm ?? 0)} de la ruta): sales de ahí con el depósito lleno`,
        fromFill: true,
      };
    }
  }
  return { startKm: 0, text: 'Sales del inicio con el depósito lleno' };
}

/** «📍 Dónde estoy»: por qué km de la ruta vas y cuánto falta para la próxima parada. */
function progressHtml(plan, r, tankL, consumption) {
  const p = state.progress;
  const btn = html`<button type="button" class="btn small" data-where>📍 ${p ? 'Actualizar' : 'Dónde estoy'}</button>`;
  if (!p) return html`<p class="small plan-where">${btn} <span class="muted">Con la ruta en marcha, te dice por qué km vas y cuánto te falta para la próxima parada.</span></p>`;
  const when = new Date(p.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (p.offKm > 3) return html`<p class="small plan-where range-note warn">${btn} Estás a ${km(p.offKm)} de la ruta (${when}).</p>`;
  const g = routeProgress(plan, p.km, { tankL, consumption, totalKm: r.route.distanceKm });
  if (g.before) return html`<p class="small plan-where range-note">${btn} Vas por el km <b>${Math.round(p.km)}</b>; el plan empieza en el km ${Math.round(g.startKm)}, donde llenaste (${when}).</p>`;
  const next = g.next
    ? html`Próxima parada: <b>${g.next.r.station.brand}</b> en <b>${km(g.toNextKm)}</b> (km ${Math.round(g.next.km)})`
    : html`Ya no tienes que parar: quedan ${km(g.toEndKm)} hasta el final`;
  return html`<p class="small plan-where range-note ${g.low ? 'warn' : 'ok'}">${btn} Vas por el km <b>${Math.round(p.km)}</b> de ${Math.round(r.route.distanceKm)} (${when}). ${next}.
    Si has llenado donde decía el plan, llevas unos <b>${String(g.fuelL).replace('.', ',')} L</b>${g.low ? ' ⚠️ ya en reserva' : ''}.</p>`;
}

/** Plan de repostaje «tipo Tesla» en la ruta (ver shared/plan.js). */
function routePlan(r, all) {
  const s = state.settings;
  const tankL = Number(s.litres), consumption = Number(s.consumption);
  if (!(tankL > 0) || !(consumption > 0)) return { plan: null, html: '' };
  const start = planStart(r);
  const plan = planStops(all, {
    totalKm: r.route.distanceKm, tankL, consumption, ...start,
    priceOf: isCompany(s) ? (x) => x.price : (x) => x.effective,
  });
  if (!plan) return { plan: null, html: '' };
  plan.start = start;
  const v = s.vehicles?.find((x) => x.id === s.vehicleId);
  const head = html`<h3>${v?.icon ?? '⛽'} Plan de repostaje <span class="muted small">(${v ? `${v.name}: ` : ''}depósito ${tankL} L · ${String(consumption).replace('.', ',')} L/100 km)</span></h3>
    <p class="small">${start.text}. Con la reserva (15 %) te da para unos <b>${Math.round(plan.rangeKm)} km</b>: entras en reserva hacia el <b>km ${Math.round(plan.emptyKm)}</b>${plan.emptyKm >= r.route.distanceKm ? ' (después del final)' : ''}.
      ${start.fromFill ? html`<button type="button" class="link small" data-plan-start>Planificar desde el inicio</button>` : state.planFromStart ? html`<button type="button" class="link small" data-plan-fill>Desde mi último llenado</button>` : ''}</p>`;
  const where = plan.ok ? progressHtml(plan, r, tankL, consumption) : '';
  const doneKm = state.progress && state.progress.offKm <= 3 ? state.progress.km + 0.3 : -1;
  let body;
  if (!plan.ok) {
    body = html`<p class="small range-note warn">⚠️ No llegas al final: hay un tramo sin gasolineras a tu alcance y te quedarías hacia el km ${Math.round(plan.reachKm)}. Amplía el «Desvío máximo» o lleva una garrafa.</p>`;
  } else if (!plan.stops.length) {
    body = html`<p class="small range-note ok">✅ No necesitas parar: llegas al final con unos ${String(plan.endLitres).replace('.', ',')} L.</p>`;
  } else {
    body = html`<ol class="plan-stops">${plan.stops.map((p, i) => html`<li><button type="button" class="plan-stop${p.km <= doneKm ? ' done' : ''}" data-open="${p.r.station.id}">
        <span><b>${p.km <= doneKm ? '✔️ ' : `${i + 1}. `}km ${Math.round(p.km)} · ${p.r.mapfre ? '🍀 ' : ''}${p.r.station.brand}</b> <span class="muted small">${p.r.station.locality ?? ''}${p.r.station.offRouteKm > 0.3 ? ` · desvío ${km(p.r.station.offRouteKm)}` : ''}</span><br>
        <span class="small">Llegas con ~${String(p.arriveL).replace('.', ',')} L · llenas ~${String(p.fillL).replace('.', ',')} L a ${eurL(p.price)} ≈ <b>${eur(p.cost)}</b>${p.r.open === false ? ' · ⚠️ ahora cerrada' : ''}</span></span>
      </button></li>`)}</ol>
      <p class="small muted">Total en la ruta: ~${Math.round(plan.litres)} L ≈ ${eur(plan.cost)}${plan.refPrice ? ` (a precio típico de la ruta serían ${eur(plan.litres * plan.refPrice)})` : ''}. Llegas al final con ~${String(plan.endLitres).replace('.', ',')} L. Paradas elegidas para gastar menos con el depósito siempre por encima de la reserva.</p>`;
  }
  return { plan, html: html`<div class="plan-card">${head}${where}${body}</div>` };
}

function renderRoute({ fit }) {
  const s = state.settings;
  const r = state.route;
  const { results, summary, comparison, companyCmp, recommendation, all } = computeList(r.stations, s[routeSortKey(s)]);
  const advice = recommendation;
  summary.recommended = advice?.best ?? null;
  const planned = routePlan(r, all);
  state.plan = planned.plan;
  // Si hay que parar, el plan ya es el consejo: no se aconseja otra gasolinera suelta.
  const planRules = !!planned.plan?.ok && planned.plan.stops.length > 0;
  if (planRules) summary.recommended = null;
  // Las paradas del plan se destacan en el mapa.
  summary.planIds = new Set((planned.plan?.stops ?? []).map((p) => p.r.station.id));
  state.computed.route = results;
  $('#route-summary').innerHTML = html`
    <p class="route-head">${r.toLabel ? html`<b>${r.fromLabel}</b> → <b>${r.toLabel}</b>` : html`🏍️ <b>${r.fromLabel}</b>`}<br>
      <span class="small">${km(r.route.distanceKm)}${r.route.durationMin ? ` · ${duration(r.route.durationMin)}` : ''} · ${results.length} gasolineras a menos de ${km(r.corridorKm)} de la ruta</span></p>
    ${planned.html}
    ${tripCostHtml(r.route.distanceKm, summary)}
    ${planRules ? '' : recommendHtml(advice, { litres: s.litres, tv: s.program.trebolValue ?? 1, route: true })}
    ${summaryHtml(summary, summaryOpts(comparison, companyCmp))}`;
  renderList($('#route-results'), results, 'route');
  bindOpeners($('#route-results'), results);
  bindSummaryLinks($('#route-summary'), all);
  $('#route-summary [data-plan-start]')?.addEventListener('click', () => { state.planFromStart = true; renderRoute({ fit: false }); });
  $('#route-summary [data-plan-fill]')?.addEventListener('click', () => { state.planFromStart = false; renderRoute({ fit: false }); });
  $('#route-summary [data-where]')?.addEventListener('click', whereAmI);
  $('#route-summary').insertAdjacentHTML('beforeend', '<div class="route-brands"></div>');
  renderBrands($('#route-summary .route-brands'), results);
  state.routeSummary = summary;
  if (state.tab === 'route') {
    map.showResults(results, summary, { fit: false });
    if (fit) map.showRoute(r.route.polyline);
  }
}

function renderBoost() {
  const rule = state.settings.program.official ?? DEFAULT_PROGRAM.official;
  const el = $('#boost-banner');
  const now = new Date();
  if (programExpired(state.settings.program, now)) {
    el.className = 'boost warn';
    el.textContent = 'La oferta de Club MAPFRE puede haber caducado: revisa las condiciones en Ajustes.';
    return;
  }
  if (isBoostDay(rule, now)) {
    el.className = 'boost on';
    el.textContent = `🍀 Hoy te devuelven el ${percentFor(rule, now)} % en tréboles (días ${rule.boostFromDay} a ${rule.boostToDay})`;
  } else {
    const d = daysUntilBoost(rule, now);
    el.className = 'boost';
    el.textContent = `🍀 Hoy ${percentFor(rule, now)} % en tréboles · el ${rule.boostPercent} % vuelve en ${d} ${d === 1 ? 'día' : 'días'}`;
  }
  const promos = activePromos(state.settings.program, now);
  $('#promo-banner').hidden = !promos.length;
  $('#promo-banner').textContent = promos.map((p) => `🎁 ${p.text}`).join(' · ');
}

/** Marca o desmarca una estación como adherida desde la lista (modo marcar). */
function toggleMark(r) {
  const s = state.settings;
  const id = r.station.id;
  const ov = s.overrides[id];
  if (r.adherida) {
    if (ov === 'in') delete s.overrides[id];
    else s.overrides[id] = 'out';
  } else if (ov === 'out') delete s.overrides[id];
  else s.overrides[id] = 'in';
  persist();
  recompute();
}

function setOfficial() {
  state.official = combineOfficial(state.serverOfficial, state.localOfficial);
  renderFreshness();
}

// ---------------------------------------------------------------- carga de datos
/** Identifica una búsqueda: lugar, radio, carburante y si se ocultan las restringidas. */
function nearbyKey() {
  const s = state.settings, c = state.center;
  return `${c.lat.toFixed(4)},${c.lon.toFixed(4)}|${s.radiusKm}|${s.fuel}|${s.hideRestricted ? 1 : 0}`;
}

function agoText(d) {
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`;
  return `del ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
}

/** Aviso de que se ven los precios guardados de la última vez. */
function showStale(mode) {
  const el = $('#stale-banner');
  if (!mode || !state.staleSince) { el.hidden = true; return; }
  const when = new Date(state.staleSince);
  const hhmm = when.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const what = html`Precios guardados de las ${hhmm} (${agoText(when)})`;
  el.innerHTML = mode === 'error'
    ? html`⚠️ Sin conexión con el servidor. ${what}. <button type="button" class="link" data-retry>Reintentar</button>`
    : html`🕒 ${what}. ${mode === 'waking' ? 'El servidor se está despertando, se actualizan solos en cuanto responda…' : 'Actualizando…'}`;
  el.querySelector('[data-retry]')?.addEventListener('click', () => { retries = 0; loadNearby({ fit: false }); });
  el.classList.toggle('error', mode === 'error');
  el.hidden = false;
}

async function loadNearby({ fit = true } = {}) {
  if (!state.center) return;
  const s = state.settings;
  const key = nearbyKey();
  if (state.nearbyKey !== key) {
    // Mientras llega la respuesta, se enseña la última lista guardada de esta misma búsqueda.
    const saved = loadLastNearby();
    if (saved?.key === key && saved.data?.stations?.length) {
      state.nearby = saved.data;
      state.nearbyKey = key;
      state.staleSince = saved.savedAt;
      recompute({ fit });
      fit = false;
      showStale('loading');
    } else {
      state.nearbyKey = null;
      state.staleSince = null;
      showStale(null);
      $('#results').innerHTML = html`<li class="empty">Buscando gasolineras…</li>`;
    }
  }
  try {
    const data = await api.stations({
      lat: state.center.lat, lon: state.center.lon, radius: s.radiusKm, fuel: s.fuel, publicOnly: s.hideRestricted,
    });
    if (nearbyKey() !== key) return; // mientras tanto se cambió la búsqueda
    state.nearby = data;
    state.nearbyKey = key;
    state.staleSince = null;
    showStale(null);
    saveLastNearby({ key, savedAt: new Date().toISOString(), data });
    recompute({ fit });
    retries = 0;
    wakeSince = null;
    // Si al abrir la app el servidor aún estaba descargando, ahora ya tiene datos.
    if (!state.status?.ready || state.status.fecha !== state.nearby.fecha) refreshStatus();
  } catch (err) {
    if (nearbyKey() !== key) return;
    // 503: el servidor está descargando los precios (unos 20 s al arrancar).
    // 502/504 o sin respuesta: Render gratuito se está despertando (hasta 1 min).
    const waking = !err.status || [502, 503, 504].includes(err.status);
    if (waking && retries < 50) {
      retries++;
      wakeSince ??= Date.now();
      if (state.staleSince) showStale('waking');
      else {
        const secs = Math.round((Date.now() - wakeSince) / 1000);
        $('#summary').innerHTML = '';
        $('#results').innerHTML = html`<li class="empty">⏳ ${err.status === 503 ? 'El servidor está descargando los precios del Ministerio' : 'El servidor se está despertando'}… se reintenta solo${secs >= 5 ? ` (${secs} s)` : ''}.<br><span class="small muted">La primera vez del día puede tardar hasta un minuto.</span></li>`;
      }
      setTimeout(() => loadNearby({ fit }), 5000);
      return;
    }
    if (state.staleSince) { showStale('error'); return; }
    $('#summary').innerHTML = '';
    $('#results').innerHTML = html`<li class="empty error">No se pudieron cargar los precios: ${err.message} <button type="button" class="btn small" id="retry">Reintentar</button></li>`;
    $('#retry')?.addEventListener('click', () => { retries = 0; loadNearby({ fit }); });
  }
}
let retries = 0;
let wakeSince = null;

/** Botón «🔄 Actualizar»: vuelve a descargar todo y busca versión nueva de la app. */
async function syncNow() {
  const btn = $('#sync');
  btn.disabled = true;
  btn.textContent = '🔄 Actualizando…';
  retries = 0;
  navigator.serviceWorker?.getRegistration?.().then((r) => r?.update()).catch(() => {});
  try {
    state.serverOfficial = await api.adheridas();
    setOfficial();
  } catch { /* sin conexión: se queda la lista que hubiera */ }
  // Que el servidor descargue ahora los precios del Ministerio si los suyos
  // tienen más de 5 minutos (tarda unos segundos).
  try { await api.refresh(); } catch { /* despertándose o sin conexión */ }
  await refreshStatus();
  await loadNearby({ fit: false });
  refreshTab(state.tab);
  btn.disabled = false;
  btn.textContent = '🔄 Actualizar';
  const d = parseFecha(state.nearby?.fecha);
  if (state.nearby && !state.staleSince && !retries) {
    toast(d ? `✓ Precios del Ministerio de las ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} (${agoText(d)})` : '✓ Precios actualizados');
  } else toast('El servidor se está despertando: la lista se actualizará sola en cuanto responda', 5000);
}

/**
 * Precios en vivo: cada 2 minutos (y al volver a la app) se pregunta al
 * servidor de cuándo son sus precios; si tiene unos más nuevos que los que se
 * ven, se vuelve a cargar la lista sin mover el mapa.
 */
async function checkLive() {
  if (document.hidden || !state.nearby || state.nearbyKey == null) return;
  try {
    const s = await api.status();
    state.status = { ...state.status, ...s };
    if (s.fecha && s.fecha !== state.nearby.fecha) await loadNearby({ fit: false });
    else renderFreshness();
  } catch { /* sin conexión: se sigue viendo lo que hay */ }
}

/**
 * Línea «a simple vista» bajo los filtros: hace cuánto son los precios que
 * ves (los del Ministerio, que el servidor descarga cada 30 min) y de cuándo
 * es la lista de adheridas.
 */
function renderFreshness() {
  const el = $('#freshness');
  if (!el) return;
  const fecha = state.nearby?.fecha ?? state.status?.fecha;
  const d = parseFecha(fecha);
  const min = d ? (Date.now() - d.getTime()) / 60000 : null;
  const prices = d ? agoText(d) : 'sin datos todavía';
  const old = min != null && min > 3 * 60; // más de 3 horas: algo va mal
  const o = state.official;
  const n = Object.keys(o?.stations ?? {}).length;
  const list = o?.updatedAt ? `${date(o.updatedAt)}${n ? ` (${n.toLocaleString('es-ES')})` : ''}` : '—';
  // La lista del mapa oficial con más de 2 meses: toca actualizarla.
  const listDays = o?.updatedAt ? (Date.now() - new Date(`${o.updatedAt}T12:00:00`).getTime()) / 86400000 : null;
  const listOld = listDays != null && listDays > 60;
  el.className = `freshness small ${old ? 'warn' : ''}`;
  el.innerHTML = html`<span title="Precios del Ministerio para la Transición Ecológica${fecha ? `: ${fecha}` : ''}">⏱ Precios: <b>${prices}</b></span>
    <span class="${listOld ? 'warn' : ''}" title="Lista de gasolineras adheridas del mapa oficial de Club MAPFRE">🍀 Adheridas: <b>${list}</b>${listOld ? html` · <a href="#" data-update-list>actualizar</a>` : ''}</span>`;
  el.querySelector('[data-update-list]')?.addEventListener('click', (e) => {
    e.preventDefault();
    selectTab('settings');
    setTimeout(() => document.getElementById('update-list')?.scrollIntoView({ behavior: 'smooth' }), 50);
  });
}

async function refreshStatus() {
  const wasReady = !!state.status?.ready;
  try {
    state.status = await api.status();
  } catch {
    return;
  }
  renderFreshness();
  $('#demo-banner').hidden = !state.status.demo;
  if (state.status.ready && !wasReady) {
    // Al arrancar el servidor la lista de carburantes llega vacía: se rellena ahora.
    try {
      const fuels = await api.fuels();
      if (fuels.length) { fillFuelSelect(fuels); syncControls(); }
    } catch { /* se queda la lista completa */ }
  }
  if (state.tab === 'settings') renderSettings(ctx);
}

/** Sitúa tu posición (GPS) en la ruta abierta y actualiza el plan. */
function whereAmI(e) {
  const r = state.route;
  if (!r?.route?.polyline?.length) return;
  if (!navigator.geolocation) return toast('Tu navegador no permite obtener la ubicación');
  const btn = e?.currentTarget;
  btn?.classList.add('busy');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      btn?.classList.remove('busy');
      if (state.route !== r) return;
      const { latitude: lat, longitude: lon } = pos.coords;
      r.cum ??= cumulativeKm(r.route.polyline);
      const prev = state.progress?.km ?? null;
      state.progress = { lat, lon, ...locateOnRoute(lat, lon, r.route.polyline, r.cum, prev), at: Date.now() };
      renderRoute({ fit: false });
      map.showUser(lat, lon);
    },
    (err) => {
      btn?.classList.remove('busy');
      toast(err.code === 1 ? 'Permiso de ubicación denegado.' : 'No se pudo obtener tu ubicación.');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
  );
}

function setCenter(lat, lon, label) {
  state.center = { lat, lon, label };
  state.settings.lastLocation = state.center;
  persist();
  $('#location-label').textContent = `📍 ${label}`;
  map.showUser(lat, lon);
  return loadNearby();
}

function locate({ silent = false } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      if (!silent) toast('Tu navegador no permite obtener la ubicación');
      return resolve(false);
    }
    $('#locate').classList.add('busy');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        $('#locate').classList.remove('busy');
        await setCenter(pos.coords.latitude, pos.coords.longitude, 'Tu ubicación');
        resolve(true);
      },
      (err) => {
        $('#locate').classList.remove('busy');
        if (!silent) {
          toast(err.code === 1
            ? 'Permiso de ubicación denegado. Escribe una dirección.'
            : 'No se pudo obtener tu ubicación (la web necesita HTTPS).');
        }
        resolve(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

async function geocodeFirst(q) {
  const { results } = await api.geocode(q);
  if (!results.length) throw new Error(`No se encontró «${q}»`);
  return results[0];
}

async function onSearch(e) {
  e.preventDefault();
  const q = $('#q').value.trim();
  if (!q) return;
  const box = $('#suggestions');
  try {
    const { results } = await api.geocode(q);
    if (!results.length) return toast(`No se encontró «${q}»`);
    if (results.length === 1) {
      box.hidden = true;
      selectTab('results');
      return setCenter(results[0].lat, results[0].lon, results[0].label);
    }
    box.innerHTML = html`${results.map((r, i) => html`<li><button type="button" data-i="${i}">${r.label}</button></li>`)}`;
    box.hidden = false;
    box.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        const r = results[Number(b.dataset.i)];
        box.hidden = true;
        $('#q').value = r.label.split(',').slice(0, 2).join(',');
        selectTab('results');
        setCenter(r.lat, r.lon, r.label);
      }),
    );
  } catch (err) {
    toast(err.message);
  }
}

async function onRoute(e) {
  e.preventDefault();
  const fromQ = $('#route-from').value.trim();
  const toQ = $('#route-to').value.trim();
  const btn = e.submitter ?? $('#route-form button[type=submit]');
  btn.disabled = true;
  $('#route-summary').innerHTML = html`<p class="muted">Calculando ruta…</p>`;
  $('#route-results').innerHTML = '';
  try {
    let from;
    if (fromQ) from = await geocodeFirst(fromQ);
    else if (state.center) from = state.center;
    else throw new Error('Indica el origen o pulsa 📍 para usar tu ubicación');
    const to = await geocodeFirst(toQ);
    const s = state.settings;
    const res = await api.route({ from, to, corridor: s.corridorKm, fuel: s.fuel, publicOnly: s.hideRestricted });
    state.route = { ...res, fromLabel: (from.label ?? 'Origen').split(',')[0], toLabel: to.label.split(',')[0] };
    state.progress = null;
    renderRoute({ fit: true });
  } catch (err) {
    $('#route-summary').innerHTML = html`<p class="error">${err.message}</p>`;
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------- mis rutas (GPX/KML)
function renderTracks() {
  const el = $('#tracks-list');
  if (!el) return;
  const cur = state.route?.track;
  el.innerHTML = html`${state.tracks.map((t) => html`<li class="${cur?.id === t.id ? 'is-current' : ''}">
    <span class="track-name"><b>${t.name}</b> <span class="muted small">${km(t.distanceKm)}${t.loop ? ' · circular' : ''}</span></span>
    <span class="track-actions">
      <button type="button" class="btn small primary" data-track-open="${t.id}">⛽ Planificar</button>
      ${t.loop ? '' : html`<button type="button" class="btn small" data-track-rev="${t.id}" title="Recorrerla en sentido contrario">⇄</button>`}
      <button type="button" class="btn small" data-track-del="${t.id}" aria-label="Borrar ${t.name}">🗑</button>
    </span></li>`)}`;
  const byId = (id) => state.tracks.find((t) => t.id === id);
  el.querySelectorAll('[data-track-open]').forEach((b) => b.addEventListener('click', () => openTrack(byId(b.dataset.trackOpen))));
  el.querySelectorAll('[data-track-rev]').forEach((b) => b.addEventListener('click', () => openTrack(byId(b.dataset.trackRev), { reverse: !(cur?.id === b.dataset.trackRev && state.route?.reversed) })));
  el.querySelectorAll('[data-track-del]').forEach((b) => b.addEventListener('click', () => {
    const t = byId(b.dataset.trackDel);
    if (!t || !confirm(`¿Borrar la ruta «${t.name}» de este móvil?`)) return;
    state.tracks = state.tracks.filter((x) => x.id !== t.id);
    saveTracks(state.tracks);
    renderTracks();
  }));
}

async function onTrackFile(e) {
  const file = e.target.files?.[0];
  e.target.value = ''; // para poder volver a elegir el mismo fichero
  if (!file) return;
  try {
    if (file.size > 30 * 1024 * 1024) throw new Error('El fichero es demasiado grande (más de 30 MB).');
    const t = parseTrack(await file.text(), file.name);
    // Si ya estaba (mismo nombre y distancia), se sustituye.
    const same = state.tracks.find((x) => x.name === t.name && Math.abs(x.distanceKm - t.distanceKm) < 0.5);
    const track = { id: same?.id ?? newId(), ...t, addedAt: new Date().toISOString() };
    state.tracks = [track, ...state.tracks.filter((x) => x.id !== track.id)].slice(0, 30);
    if (!saveTracks(state.tracks)) toast('No se pudo guardar la ruta en el móvil (¿sin espacio?), pero se planifica igual.');
    renderTracks();
    toast(`🏍️ Ruta «${track.name}» cargada: ${km(track.distanceKm)}`);
    await openTrack(track);
  } catch (err) {
    $('#route-summary').innerHTML = html`<p class="error">${err.message}</p>`;
  }
}

/** Busca las gasolineras del track y pinta el plan de repostaje. */
async function openTrack(t, { reverse = false } = {}) {
  if (!t) return;
  const s = state.settings;
  $('#route-summary').innerHTML = html`<p class="muted">Buscando gasolineras en «${t.name}»…</p>`;
  $('#route-results').innerHTML = '';
  try {
    const points = reverse ? t.points.slice().reverse() : t.points;
    const res = await api.track({ points, corridor: s.corridorKm, fuel: s.fuel, publicOnly: s.hideRestricted });
    state.route = { ...res, fromLabel: `${t.name}${reverse ? ' (al revés)' : ''}`, toLabel: null, track: t, reversed: reverse };
    state.planFromStart = false;
    state.progress = null;
    renderTracks();
    renderRoute({ fit: true });
  } catch (err) {
    $('#route-summary').innerHTML = html`<p class="error">${err.message}</p>`;
  }
}

/**
 * Tras registrar un repostaje: si fue en una gasolinera de la ruta abierta, el
 * plan sale de ahí con el depósito lleno y se dice dónde toca el siguiente.
 */
function afterRefuel(entry) {
  if (!state.route || !entry.stationId) return;
  state.planFromStart = false;
  renderRoute({ fit: false });
  const plan = state.plan;
  if (plan?.start?.entryId !== entry.id) return;
  const next = plan.stops[0];
  if (!plan.ok) toast('⚠️ Desde aquí no llegas al final de la ruta: mira el plan de repostaje.', 6000);
  else if (next) toast(`⛽ Próximo llenado: km ${Math.round(next.km)} en ${next.r.station.brand} (${eurL(next.price)}), llegarás con ~${String(next.arriveL).replace('.', ',')} L.`, 7000);
  else toast(`✅ Con este depósito acabas la ruta (te sobran ~${String(plan.endLitres).replace('.', ',')} L).`, 6000);
}

// ---------------------------------------------------------------- ficha
async function openDetailById(id) {
  try {
    const { station } = await api.station(id);
    openDetail(station);
  } catch (err) {
    toast(err.message);
  }
}

function openDetail(st) {
  const dlg = $('#detail');
  const s = state.settings;
  const draw = () => {
    dlg.innerHTML = detailHtml(st, {
      settings: s, official: state.official, favorite: isFavorite(state.favorites, st.id), fecha: state.nearby?.fecha ?? state.status?.fecha,
      note: state.notes[st.id], capLeft: capLeftToday(),
    });
    dlg.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => onAction(b.dataset.action)));
    dlg.querySelector('#station-note')?.addEventListener('change', (e) => {
      const text = e.target.value.trim();
      state.notes = { ...state.notes, [st.id]: { ...(state.notes[st.id] ?? {}), note: text, date: todayISO() } };
      saveNotes(state.notes);
      toast('Nota guardada');
      recompute();
    });
    loadHistory();
  };
  const onAction = async (action) => {
    if (action === 'fav') {
      state.favorites = toggleFavorite(state.favorites, st);
      toast(isFavorite(state.favorites, st.id) ? 'Añadida a favoritas ★' : 'Quitada de favoritas');
      draw();
      recompute();
    } else if (action.startsWith('mark-')) {
      const v = { 'mark-in': 'in', 'mark-out': 'out', 'mark-clear': null }[action];
      if (v) s.overrides[st.id] = v;
      else delete s.overrides[st.id];
      persist();
      draw();
      recompute();
    } else if (action === 'verdict-ok' || action === 'verdict-ko') {
      setVerdict(st, action === 'verdict-ok' ? 'ok' : 'ko');
      draw();
    } else if (action === 'card') {
      dlg.close();
      openCard(ctx);
    } else if (action === 'refuel') {
      dlg.close();
      openRefuel(ctx, st);
    } else if (action === 'share') {
      const text = `${st.brand} · ${st.address}, ${st.locality}: ${fuelLabel(s.fuel)} a ${eurL(st.prices[s.fuel])}`;
      const url = `https://www.google.com/maps/search/?api=1&query=${st.lat},${st.lon}`;
      try {
        if (navigator.share) await navigator.share({ title: st.brand, text, url });
        else { await navigator.clipboard.writeText(`${text} ${url}`); toast('Copiado al portapapeles'); }
      } catch { /* cancelado */ }
    }
  };
  let historyToken = 0;
  const loadHistory = async () => {
    const token = ++historyToken;
    const box = dlg.querySelector('#history-chart');
    try {
      const { series } = await api.history(st.id, 30);
      if (token !== historyToken || !box.isConnected) return;
      const pts = series.map((p) => ({ date: p.date, value: p.prices[s.fuel] ?? null }));
      box.innerHTML = lineChart(pts, { label: `Histórico de ${fuelLabel(s.fuel)}` });
    } catch (err) {
      if (box.isConnected) box.innerHTML = html`<p class="muted small">Histórico no disponible (${err.message}).</p>`;
    }
  };
  draw();
  if (!dlg.open) dlg.showModal();
}

// ---------------------------------------------------------------- pestañas
function selectTab(tab) {
  const prev = state.tab;
  state.tab = tab;
  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  document.querySelectorAll('section.tab').forEach((sec) => { sec.hidden = sec.dataset.tab !== tab; });
  if (tab === 'route') {
    if (state.route) {
      map.showResults(state.computed.route, state.routeSummary ?? summarize(state.computed.route), { fit: false });
      map.showRoute(state.route.route.polyline);
    }
  } else {
    map.clearRoute();
    if (state.nearby) {
      map.showResults(state.computed.nearby, summarize(state.computed.nearby), {
        center: state.nearby.center, radiusKm: state.nearby.radiusKm, fit: tab === 'results' || prev === 'route',
      });
    }
  }
  refreshTab(tab);
}

function refreshTab(tab) {
  if (tab !== state.tab) return;
  if (tab === 'favorites') renderFavorites(ctx);
  else if (tab === 'log') renderLog(ctx);
  else if (tab === 'settings') {
    renderSettings(ctx);
    refreshStatus();
  }
}

// ---------------------------------------------------------------- controles
function fillFuelSelect(fuels) {
  const sel = $('#fuel');
  const list = fuels?.length ? fuels : FUELS;
  sel.innerHTML = html`${list.map((f) => html`<option value="${f.key}">${f.label}</option>`)}`;
  if (!list.some((f) => f.key === state.settings.fuel)) state.settings.fuel = list[0].key;
}

function fillVehicleSelect() {
  const s = state.settings;
  $('#vehicle').innerHTML = html`${s.vehicles.map((v) => html`<option value="${v.id}">${v.icon} ${v.name} · ${v.litres} L</option>`)}`;
  $('#vehicle').value = s.vehicleId;
  $('#vehicle-chip').hidden = s.vehicles.length < 2;
}

function syncControls() {
  const s = state.settings;
  fillVehicleSelect();
  const company = isCompany(s);
  document.querySelectorAll('.mode-switch [data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === (s.mode ?? 'personal'))));
  document.body.classList.toggle('mode-company', company);
  $('#sort').innerHTML = html`${Object.entries(company ? COMPANY_SORTS : SORTS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}`;
  $('#route-sort').innerHTML = html`${Object.entries(routeSorts(s)).map(([k, v]) => html`<option value="${k}">${v}</option>`)}`;
  $('#fuel').value = s.fuel;
  $('#radius').value = String(s.radiusKm);
  $('#sort').value = s[sortKey(s)];
  $('#only-mapfre').checked = s.onlyMapfre;
  $('#official-filter').value = s.officialFilter ?? 'all';
  $('#open-now').checked = s.openNow;
  $('#route-corridor').value = String(s.corridorKm);
  $('#route-sort').value = s[routeSortKey(s)];
}

function bindControls() {
  $('#official-filter').innerHTML = html`${Object.entries(OFFICIAL_FILTERS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}`;
  $('#search-form').addEventListener('submit', onSearch);
  $('#locate').addEventListener('click', () => { selectTab('results'); locate(); });
  $('#route-form').addEventListener('submit', onRoute);
  $('#track-file').addEventListener('change', onTrackFile);
  renderTracks();
  const s = () => state.settings;
  const refetch = () => {
    persist();
    loadNearby({ fit: true });
    if (state.route?.track) {
      // Un track propio se vuelve a pedir solo, con el nuevo carburante.
      openTrack(state.route.track, { reverse: state.route.reversed });
    } else if (state.route) {
      // La ruta se filtró en el servidor por carburante: hay que repetirla.
      state.route = null;
      map.clearRoute();
      $('#route-summary').innerHTML = html`<p class="muted small">Vuelve a buscar la ruta con el nuevo carburante.</p>`;
      $('#route-results').innerHTML = '';
    }
  };
  $('#fuel').addEventListener('change', (e) => { s().fuel = e.target.value; syncActiveVehicle(s()); fillVehicleSelect(); refetch(); });
  $('#vehicle').addEventListener('change', (e) => {
    const before = s().fuel;
    selectVehicle(s(), e.target.value); // y lo recuerda para el modo actual
    syncControls();
    if (s().fuel !== before) refetch();
    else { persist(); recompute(); }
    toast(`Vehículo: ${$('#vehicle').selectedOptions[0]?.textContent ?? ''}`);
  });
  $('#radius').addEventListener('change', (e) => { s().radiusKm = Number(e.target.value); persist(); loadNearby({ fit: true }); });
  document.querySelectorAll('.mode-switch [data-mode]').forEach((b) => b.addEventListener('click', () => {
    if ((s().mode ?? 'personal') === b.dataset.mode) return;
    const before = s().fuel;
    switchMode(s(), b.dataset.mode);
    syncControls();
    if (s().fuel !== before) refetch();
    else { persist(); recompute(); }
    refreshTab('log');
    toast(`${MODES[s().mode].icon} ${MODES[s().mode].long}${isCompany(s()) ? ': paga la empresa, los tréboles son tuyos' : ': pagas tú'}`);
  }));
  $('#sort').addEventListener('change', (e) => { s()[sortKey(s())] = e.target.value; persist(); recompute(); });
  $('#only-mapfre').addEventListener('change', (e) => { s().onlyMapfre = e.target.checked; persist(); recompute(); });
  $('#official-filter').addEventListener('change', (e) => { s().officialFilter = e.target.value; persist(); recompute(); });
  $('#open-now').addEventListener('change', (e) => { s().openNow = e.target.checked; persist(); recompute(); });
  $('#route-corridor').addEventListener('change', (e) => { s().corridorKm = Number(e.target.value); persist(); });
  $('#route-sort').addEventListener('change', (e) => { s()[routeSortKey(s())] = e.target.value; persist(); if (state.route) renderRoute({ fit: false }); });
  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
  $('#log-add').addEventListener('click', () => openRefuel(ctx, null));
  $('#open-card').addEventListener('click', () => openCard(ctx));
  $('#sync').addEventListener('click', syncNow);
  $('#log-export').addEventListener('click', () => {
    if (!state.log.length) return toast('No hay repostajes que exportar');
    exportLogCsv(state);
  });
  document.addEventListener('click', (e) => {
    if (!$('#suggestions').contains(e.target) && e.target !== $('#q')) $('#suggestions').hidden = true;
  });
  // Cerrar los diálogos al pulsar fuera.
  for (const dlg of document.querySelectorAll('dialog')) {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }
  window.addEventListener('resize', () => map.invalidate());
}

// ---------------------------------------------------------------- arranque
const map = createMap($('#map'), { onSelect: (r) => openDetail(r.station) });

const ctx = {
  state, api, toast, persist, recompute, renderBoost, refreshTab, openDetailById, syncControls, afterRefuel,
  setOfficial: () => { setOfficial(); recompute(); },
  setVerdict: (st, v) => setVerdict(st, v),
  selectTab: (t) => selectTab(t),
  capLeftToday,
  reload: () => { persist(); loadNearby({ fit: false }); },
  refetch: () => { syncControls(); persist(); loadNearby({ fit: false }); },
};

/**
 * La lista del mapa oficial enviada con el marcador «Enviar a Tréboles»
 * (shared/capturar.js): se recoge del servidor con su código de un solo uso y
 * se empareja como una importación, en Ajustes, para revisarla y guardarla.
 */
function importFromMap(code) {
  selectTab('settings');
  if (!code) {
    toast('Abre la app con el botón «Enviar a Tréboles» del mapa oficial (Ajustes → Actualizar la lista)', 8000);
    return;
  }
  importEntries(ctx, api.capture(code));
}

async function init() {
  // Accesos directos del icono de la app (?accion=carnet|cerca|repostaje|ruta).
  const params = new URLSearchParams(location.search);
  const accion = params.get('accion');
  if (accion) history.replaceState(null, '', location.pathname);
  bindControls();
  if (accion === 'importar-mapa') importFromMap(params.get('captura'));
  // El carnet se abre al momento, sin esperar a los precios.
  if (accion === 'carnet') openCard(ctx);
  setupInstallBanner({
    el: $('#install-banner'),
    dismissed: () => !!state.settings.installDismissed,
    onDismiss: () => { state.settings.installDismissed = true; persist(); },
    toast,
  });
  onInstallChange(() => refreshTab('settings'));
  fillFuelSelect(FUELS);
  syncControls();
  renderBoost();

  setOfficial();
  // Lista de adheridas empaquetada con la app: sale de la caché del service
  // worker, así que está al instante y sin conexión aunque el servidor duerma.
  try {
    state.serverOfficial = await api.adheridasLocal();
    setOfficial();
  } catch {
    /* primera visita sin conexión: se usan las reglas por marca */
  }
  // Y en segundo plano, la publicada más reciente (sin bloquear el arranque).
  api.adheridas()
    .then((o) => { state.serverOfficial = o; ctx.setOfficial(); })
    .catch(() => { /* sin conexión: se queda la empaquetada */ });
  // Render gratuito se duerme: el primer arranque puede tardar casi un minuto.
  let slowShown = false;
  const slow = setTimeout(() => {
    slowShown = true;
    toast('Conectando con el servidor… la primera vez puede tardar hasta 1 minuto', 60000);
  }, 2500);
  try {
    state.status = await api.status();
    clearTimeout(slow);
    if (slowShown) toast('Conectado ✓', 1500);
    renderFreshness();
    $('#demo-banner').hidden = !state.status.demo;
    const fuels = await api.fuels();
    if (fuels.length) { fillFuelSelect(fuels); syncControls(); }
  } catch {
    clearTimeout(slow);
    toast('No se pudo conectar con el servidor');
  }


  const last = state.settings.lastLocation;
  if (accion === 'cerca' && (await locate())) {
    /* ya buscado alrededor de tu posición */
  } else if (last) await setCenter(last.lat, last.lon, last.label);
  else if (!(await locate({ silent: true }))) {
    await setCenter(DEFAULT_CENTER.lat, DEFAULT_CENTER.lon, DEFAULT_CENTER.label);
    toast('Escribe una dirección o pulsa 📍 para buscar cerca de ti', 5000);
  }
  if (accion === 'repostaje') openRefuel(ctx, null);
  if (accion === 'ruta') selectTab('route');
  checkAlerts(ctx);
}

init();
setInterval(renderFreshness, 60_000); // «hace X min» se mantiene al día
setInterval(checkLive, 2 * 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkLive(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  // Cuando se publica una versión nueva, se avisa para recargar.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    const b = $('#update-banner');
    b.hidden = false;
    b.querySelector('button').addEventListener('click', () => location.reload(), { once: true });
  });
}
