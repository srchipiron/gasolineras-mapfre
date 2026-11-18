// Aplicación principal: búsqueda, mapa, lista y pestañas.

import { api } from './api.js';
import { createMap } from './map.js';
import { html, eurL, km, duration, todayISO } from './format.js';
import { resultItem, summaryHtml, detailHtml, adviceHtml } from './render.js';
import { lineChart } from './chart.js';
import {
  loadSettings, saveSettings, loadFavorites, loadLog, isFavorite, toggleFavorite, loadLocalOfficial, loadNotes, saveNotes,
} from './store.js';
import { renderFavorites, checkAlerts } from './views/favorites.js';
import { renderLog, exportLogCsv } from './views/log.js';
import { renderSettings } from './views/settings.js';
import { openRefuel } from './views/refuel.js';
import { enrich, filterResults, sortResults, summarize, SORTS } from '/shared/ranking.js';
import { FUELS, fuelLabel } from '/shared/fuels.js';
import {
  isBoostDay, percentFor, daysUntilBoost, programExpired, activePromos, mergeOfficial, emptyOfficial, DEFAULT_PROGRAM,
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
  route: null, // respuesta de /api/route + etiquetas
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
  const filtered = filterResults(enriched, {
    onlyMapfre: s.onlyMapfre, openNow: s.openNow, hideRestricted: s.hideRestricted,
  });
  return { results: sortResults(filtered, sort), summary: summarize(filtered) };
}

function renderList(el, results, mode) {
  const s = state.settings;
  const shown = results.slice(0, 150);
  el.innerHTML = html`${shown.map((r, i) => resultItem(r, i, { litres: s.litres, mode, markMode: s.markMode, favorite: isFavorite(state.favorites, r.station.id), note: state.notes[r.station.id] }))}${
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
    const { results, summary } = computeList(state.nearby.stations, s.sort);
    state.computed.nearby = results;
    $('#summary').innerHTML = summaryHtml(summary, {
      litres: s.litres, fuel: s.fuel, program: s.program, capLeft: capLeftToday(),
      onlyMapfre: s.onlyMapfre, officialCount: Object.keys(state.official?.stations ?? {}).length + Object.values(s.overrides).filter((v) => v === 'in').length,
    });
    renderAdvice(summary);
    renderList($('#results'), results, 'nearby');
    bindOpeners($('#results'), results);
    bindSummaryLinks($('#summary'), results);
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

function renderRoute({ fit }) {
  const s = state.settings;
  const r = state.route;
  const { results, summary } = computeList(r.stations, s.routeSort === 'along' ? 'along' : s.routeSort);
  state.computed.route = results;
  $('#route-summary').innerHTML = html`
    <p class="route-head"><b>${r.fromLabel}</b> → <b>${r.toLabel}</b><br>
      <span class="small">${km(r.route.distanceKm)} · ${duration(r.route.durationMin)} · ${results.length} gasolineras a menos de ${km(r.corridorKm)} de la ruta</span></p>
    ${summaryHtml(summary, {
      litres: s.litres, fuel: s.fuel, program: s.program, capLeft: capLeftToday(),
      onlyMapfre: s.onlyMapfre, officialCount: Object.keys(state.official?.stations ?? {}).length + Object.values(s.overrides).filter((v) => v === 'in').length,
    })}`;
  renderList($('#route-results'), results, 'route');
  bindOpeners($('#route-results'), results);
  bindSummaryLinks($('#route-summary'), results);
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
  state.official = mergeOfficial(state.serverOfficial, state.localOfficial);
}

// ---------------------------------------------------------------- carga de datos
async function loadNearby({ fit = true } = {}) {
  if (!state.center) return;
  const s = state.settings;
  $('#results').innerHTML = html`<li class="empty">Buscando gasolineras…</li>`;
  try {
    state.nearby = await api.stations({
      lat: state.center.lat, lon: state.center.lon, radius: s.radiusKm, fuel: s.fuel, publicOnly: s.hideRestricted,
    });
    recompute({ fit });
    retries = 0;
  } catch (err) {
    $('#summary').innerHTML = '';
    if (err.status === 503 && retries < 40) {
      // El servidor está descargando los precios del Ministerio (tarda ~20 s al arrancar).
      retries++;
      $('#results').innerHTML = html`<li class="empty">⏳ Descargando los precios del Ministerio… (se reintenta solo)</li>`;
      setTimeout(() => loadNearby({ fit }), 5000);
      return;
    }
    $('#results').innerHTML = html`<li class="empty error">No se pudieron cargar los precios: ${err.message} <button type="button" class="btn small" id="retry">Reintentar</button></li>`;
    $('#retry')?.addEventListener('click', () => { retries = 0; loadNearby({ fit }); });
  }
}
let retries = 0;

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
    renderRoute({ fit: true });
  } catch (err) {
    $('#route-summary').innerHTML = html`<p class="error">${err.message}</p>`;
  } finally {
    btn.disabled = false;
  }
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
      map.showResults(state.computed.route, summarize(state.computed.route), { fit: false });
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
  else if (tab === 'settings') renderSettings(ctx);
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
  $('#fuel').value = s.fuel;
  $('#radius').value = String(s.radiusKm);
  $('#sort').value = s.sort;
  $('#only-mapfre').checked = s.onlyMapfre;
  $('#open-now').checked = s.openNow;
  $('#route-corridor').value = String(s.corridorKm);
  $('#route-sort').value = s.routeSort;
}

function bindControls() {
  $('#sort').innerHTML = html`${Object.entries(SORTS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}`;
  $('#search-form').addEventListener('submit', onSearch);
  $('#locate').addEventListener('click', () => { selectTab('results'); locate(); });
  $('#route-form').addEventListener('submit', onRoute);
  const s = () => state.settings;
  const refetch = () => {
    persist();
    loadNearby({ fit: true });
    if (state.route) {
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
    selectVehicle(s(), e.target.value);
    syncControls();
    if (s().fuel !== before) refetch();
    else { persist(); recompute(); }
    toast(`Vehículo: ${$('#vehicle').selectedOptions[0]?.textContent ?? ''}`);
  });
  $('#radius').addEventListener('change', (e) => { s().radiusKm = Number(e.target.value); persist(); loadNearby({ fit: true }); });
  $('#sort').addEventListener('change', (e) => { s().sort = e.target.value; persist(); recompute(); });
  $('#only-mapfre').addEventListener('change', (e) => { s().onlyMapfre = e.target.checked; persist(); recompute(); });
  $('#open-now').addEventListener('change', (e) => { s().openNow = e.target.checked; persist(); recompute(); });
  $('#route-corridor').addEventListener('change', (e) => { s().corridorKm = Number(e.target.value); persist(); });
  $('#route-sort').addEventListener('change', (e) => { s().routeSort = e.target.value; persist(); if (state.route) renderRoute({ fit: false }); });
  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
  $('#log-add').addEventListener('click', () => openRefuel(ctx, null));
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
  state, api, toast, persist, recompute, renderBoost, refreshTab, openDetailById, syncControls,
  setOfficial: () => { setOfficial(); recompute(); },
  setVerdict: (st, v) => setVerdict(st, v),
  capLeftToday,
  reload: () => { persist(); loadNearby({ fit: false }); },
  refetch: () => { syncControls(); persist(); loadNearby({ fit: false }); },
};

async function init() {
  bindControls();
  fillFuelSelect(FUELS);
  syncControls();
  renderBoost();

  setOfficial();
  try {
    state.serverOfficial = await api.adheridas();
    setOfficial();
  } catch {
    /* sin lista compartida: se usan las reglas por marca */
  }
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
    $('#demo-banner').hidden = !state.status.demo;
    const fuels = await api.fuels();
    if (fuels.length) { fillFuelSelect(fuels); syncControls(); }
  } catch {
    clearTimeout(slow);
    toast('No se pudo conectar con el servidor');
  }

  // Accesos directos del icono de la app (?accion=cerca|repostaje|ruta).
  const accion = new URLSearchParams(location.search).get('accion');
  if (accion) history.replaceState(null, '', location.pathname);

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
