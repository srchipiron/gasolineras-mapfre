// Pestaña "Ajustes": repostaje, gasolineras adheridas, reglas y datos.

import { html, raw, date } from '../format.js';
import { DEFAULT_PROGRAM, combineOfficial, diffOfficial, emptyOfficial, TIPOS } from '/shared/treboles.js';
import { parseLocatorPayload } from '/shared/locator.js';
import { bookmarklet, MAPA_OFICIAL, TODA_ESPANA } from '/shared/capturar.js';
import { provinciaName } from '/shared/provincias.js';
import { resetSettings, saveLocalOfficial, KEYS } from '../store.js';
import { cardSettingsHtml, bindCardSettings } from './card.js';
import { installSectionHtml, promptInstall } from '../install.js';
import { backupSectionHtml, bindBackup } from './backup.js';
import { FUELS } from '/shared/fuels.js';
import { CHANGELOG, APP_VERSION, versionStatus } from '/shared/changelog.js';
import { VEHICLE_ICONS, addVehicle, updateVehicle, removeVehicle, selectVehicle } from '/shared/vehiculos.js';

let lastImport = null; // resultado del último emparejado, pendiente de guardar
let importing = false; // emparejando ahora mismo
let importError = null; // último error al importar (se mantiene al repintar Ajustes)
const WAITING = '<p class="muted">⏳ Emparejando con las gasolineras del Ministerio… (si el servidor estaba dormido, tarda hasta un minuto)</p>';

function officialSection(ctx) {
  const { state } = ctx;
  const off = state.official ?? emptyOfficial();
  const server = state.serverOfficial ?? emptyOfficial();
  const local = state.localOfficial ?? emptyOfficial();
  const total = Object.keys(off.stations).length;
  const byTipo = {};
  for (const v of Object.values(off.stations)) byTipo[v.tipo] = (byTipo[v.tipo] ?? 0) + 1;
  const ov = Object.values(state.settings.overrides);
  return html`
    <h3>Gasolineras adheridas a Club MAPFRE</h3>
    <p class="small">Solo cuentan como adheridas las gasolineras de la <b>lista oficial del mapa de Club MAPFRE</b> («Más EESS colaboradoras» y «Gasolinera Repsol», importadas desde el HAR) y las que marques tú. Nada se deduce por la marca ni de otras webs. En la lista puedes filtrar por tipo, como en el mapa oficial.</p>
    <div class="kpis">
      <div class="kpi"><span class="label">Más EESS colaboradoras</span><strong>${byTipo.colaboradora ?? 0}</strong><span class="small">${total ? `de ${total} en la lista oficial` : 'sin importar'}</span></div>
      <div class="kpi"><span class="label">Gasolinera Repsol</span><strong>${byTipo.repsol ?? 0}</strong><span class="small">del mapa oficial</span></div>
      <div class="kpi"><span class="label">Marcadas a mano</span><strong>${ov.filter((v) => v === 'in').length} / ${ov.filter((v) => v === 'out').length}</strong><span class="small">adheridas / no adheridas</span></div>
    </div>
    <p class="small ${Object.keys(server.stations).length ? '' : 'warn'}">${Object.keys(server.stations).length
      ? html`🌐 <b>Lista para todos</b> (en el servidor): ${Object.keys(server.stations).length} gasolineras, actualizada el ${date(server.updatedAt)}. Importadas solo en este dispositivo: ${Object.keys(local.stations).length}.`
      : html`🌐 La lista para todos (en el servidor) está <b>vacía</b>: las adheridas solo se ven en el dispositivo donde se importaron (aquí: ${Object.keys(local.stations).length}). Usa «Publicar para todos» para que cualquiera las vea.`}</p>
    ${revisionHtml(server)}

    <label class="chip"><input type="checkbox" data-k="markMode" ${state.settings.markMode ? 'checked' : ''}> Modo marcar: botón «＋ Adherida» / «✓ Adherida» en cada gasolinera de la lista</label>

    <fieldset class="rule on" id="update-list">
      <legend><b>🔄 Actualizar la lista desde el mapa oficial</b></legend>
      <p class="small">Con un clic, en el ordenador (Chrome, Edge o Firefox). La primera vez:</p>
      <ol class="small steps">
        <li>Arrastra este botón a tu <b>barra de marcadores</b> (si no la ves: <kbd>Ctrl</kbd>+<kbd>Mayús</kbd>+<kbd>B</kbd>):
          <a class="btn primary bookmarklet" id="bookmarklet" href="#" title="Arrástrame a la barra de marcadores">🍀 Enviar a Tréboles</a>
          <button type="button" class="btn small" id="bookmarklet-copy">o copia su código</button></li>
      </ol>
      <p class="small">Cada vez que quieras actualizarla:</p>
      <ol class="small steps">
        <li>Abre <a href="${MAPA_OFICIAL}" target="_blank" rel="noopener">el mapa oficial de Club MAPFRE</a> y pulsa el marcador «🍀 Enviar a Tréboles».</li>
        <li>En el buscador del mapa, escribe cualquier ciudad y elígela: el mapa descarga la lista de toda España.</li>
        <li>Pulsa «Enviar a Tréboles» en el recuadro verde. Se abre la app con lo que ha cambiado (nuevas, quitadas…) y pulsas «Guardar».</li>
      </ol>
      <p class="small muted">El marcador solo lee lo que el mapa ya te ha enseñado en tu navegador, como un HAR: no usa claves de MAPFRE ni envía tus datos.</p>
      <div id="import-result">${lastImport ? importResult(lastImport, state) : importing ? raw(WAITING) : importError ?? ''}</div>
    </fieldset>

    <fieldset class="rule">
      <legend><b>Importar del mapa oficial (HAR o JSON)</b></legend>
      <label class="field"><span>Fichero HAR o JSON guardado desde el mapa oficial</span>
        <input type="file" id="import-file" accept=".har,.json,application/json" multiple></label>
      <label class="field"><span>…o pega aquí la respuesta copiada</span>
        <textarea id="import-text" rows="3" placeholder='{"message":{"contenido":[...]}}'></textarea></label>
      <button type="button" class="btn" id="import-run">Leer y emparejar</button>
      <p class="small muted">El resultado aparece arriba, en «Actualizar la lista».</p>
      <details class="small">
        <summary>Cómo sacar la lista del mapa oficial (ordenador, Chrome o Edge)</summary>
        <ol>
          <li>Abre <a href="${DEFAULT_PROGRAM.officialMapUrl}" target="_blank" rel="noopener">el mapa oficial de Club MAPFRE</a>.</li>
          <li>Pulsa <b>F12</b> y ve a la pestaña <b>Red</b> (Network). Déjala abierta.</li>
          <li>En el buscador del mapa, busca cualquier ciudad: cada búsqueda descarga las gasolineras de toda España.</li>
          <li>En la pestaña Red, haz clic derecho sobre cualquier petición y elige <b>Guardar todo como HAR</b> (Save all as HAR).</li>
          <li>Aquí, elige ese fichero y pulsa «Leer y emparejar». Revisa el resultado y pulsa «Guardar».</li>
        </ol>
        <p>El fichero se lee en tu navegador: al servidor solo se envían las posiciones y nombres de las gasolineras, nunca tus cookies ni tus datos.</p>
      </details>
    </fieldset>

    ${publishHtml(ctx, mergedList(state))}

    <div class="row wrap">
      <button type="button" class="btn" id="export-list">Descargar lista (adheridas.json)</button>
      ${Object.keys(local.stations).length || local.provinces.length ? html`<button type="button" class="btn danger" id="clear-local">Borrar lo importado aquí</button>` : ''}
    </div>
    <p class="small muted">«Descargar lista» une la lista compartida, lo importado aquí y tus marcas. Pásame ese fichero y lo subo al repositorio para que lo veas en todos tus dispositivos.</p>`;
}

function publishHtml(ctx, merged) {
  const n = Object.keys(merged.stations).length;
  const st = ctx.state.status;
  if (!n) return '';
  return html`
    <fieldset class="rule on">
      <legend><b>🌐 Publicar para todos</b></legend>
      <p class="small">Sube la lista que ves en este dispositivo (${n} gasolineras: la compartida, lo importado aquí y tus marcas) al servidor, para que la app la use en todos los móviles sin importar nada.
        ${st && !st.canPublish ? html`<br><span class="warn">El servidor aún no lo permite: hay que poner la variable <b>ADMIN_KEY</b> en Render (ver README).</span>` : ''}
        ${st?.canPublish && !st.publishPersists ? html`<br><span class="warn">Sin <b>GITHUB_TOKEN</b> en Render, la lista se perderá cuando el servidor se reinicie.</span>` : ''}</p>
      <div class="row">
        <label class="field"><span>Clave de administrador (ADMIN_KEY)</span><input type="password" id="publish-key" autocomplete="current-password"></label>
      </div>
      <button type="button" class="btn primary" id="publish-run">📤 Publicar ${n} gasolineras para todos</button>
      <div id="publish-result"></div>
    </fieldset>`;
}

/** ¿Es una importación de toda España? (el mapa oficial la trae entera en cada búsqueda) */
const isFull = (r) => r.received >= TODA_ESPANA;

const TIPO_CORTO = { colaboradora: 'colaboradora', repsol: 'Gasolinera Repsol', manual: 'marcada a mano' };
const nameList = (items) => html`<ul>${items.slice(0, 150).map((x) => html`<li>${x.nombre || x.id} <span class="muted">(${TIPO_CORTO[x.tipo] ?? x.tipo}${x.antes ? `, antes ${TIPO_CORTO[x.antes] ?? x.antes}` : ''})</span></li>`)}${items.length > 150 ? html`<li class="muted">… y ${items.length - 150} más</li>` : ''}</ul>`;

/** Qué cambia frente a la lista que usas ahora (solo en importaciones de toda España). */
function diffHtml(r, state) {
  const current = state ? combineOfficial(state.serverOfficial, state.localOfficial) : null;
  const curCount = Object.values(current?.stations ?? {}).filter((v) => v.tipo !== 'manual').length;
  if (!isFull(r) || !curCount) return '';
  const d = diffOfficial(current, r.matched);
  const suspicious = d.quitadas.length > curCount * 0.25;
  return html`
    <div class="diff ${suspicious ? 'warn' : ''}">
      <p><b>Frente a la lista que usas ahora</b> (${curCount}, del ${date(current.updatedAt)}):
        ${!d.nuevas.length && !d.quitadas.length && !d.cambian.length ? html`<b>no ha cambiado nada</b> ✓.` : html`
        <b class="good">+${d.nuevas.length}</b> nuevas · <b class="bad">−${d.quitadas.length}</b> ya no están en el mapa${d.cambian.length ? html` · <b>${d.cambian.length}</b> cambian de tipo` : ''}.`}</p>
      ${d.nuevas.length ? html`<details class="small"><summary>Ver las ${d.nuevas.length} nuevas</summary>${nameList(d.nuevas)}</details>` : ''}
      ${d.quitadas.length ? html`<details class="small"><summary>Ver las ${d.quitadas.length} que ya no están</summary>${nameList(d.quitadas)}</details>` : ''}
      ${d.cambian.length ? html`<details class="small"><summary>Ver las ${d.cambian.length} que cambian de tipo</summary>${nameList(d.cambian)}</details>` : ''}
      ${suspicious ? html`<p class="small warn">Faltan muchas respecto a la lista actual. Si el mapa oficial no ha terminado de cargar, descarta y vuelve a enviarla.</p>` : ''}
    </div>`;
}

function importResult(r, state) {
  const full = isFull(r);
  const provinces = html`<table class="prices">
      <thead><tr><th>Provincia</th><th>Adheridas encontradas</th></tr></thead>
      <tbody>${r.provinces.map((p) => html`<tr><td>${provinciaName(p.idProvincia)}</td><td>${p.count} de ${p.total} gasolineras</td></tr>`)}</tbody>
    </table>`;
  return html`
    <p>${full ? html`📥 <b>Lista de toda España</b> del mapa oficial: ` : ''}<b>${r.matched.length}</b> gasolineras emparejadas de ${r.received} leídas${r.unmatched.length ? html`, <b>${r.unmatched.length}</b> sin emparejar` : ''}:
      <b>${r.matched.filter((m) => m.tipo === 'colaboradora').length}</b> «Más EESS colaboradoras» y ${r.matched.filter((m) => m.tipo === 'repsol').length} «Gasolinera Repsol».</p>
    ${diffHtml(r, state)}
    ${full ? html`<details class="small"><summary>Ver por provincia</summary>${provinces}</details>` : provinces}
    <details class="small"><summary>Ver las ${r.matched.length} emparejadas (mapa oficial → Ministerio)</summary>
      <ul class="pairs">${r.matched.map((m) => html`<li class="${m.por === 'posición' ? 'weak' : ''}"><b>${m.nombre}</b> · ${m.direccionOficial || '—'}<br>→ ${m.brand} · ${m.address}, ${m.locality} <span class="muted">(${m.distanceM} m, por ${m.por})</span></li>`)}</ul></details>
    ${r.unmatched.length ? html`<details class="small"><summary>Ver las ${r.unmatched.length} sin emparejar (revísalas y márcalas a mano)</summary><ul>${r.unmatched.slice(0, 200).map((u) => html`<li>${u.nombre} · ${u.direccion}, ${u.localidad}</li>`)}</ul></details>` : ''}
    <div class="row wrap"><button type="button" class="btn primary" id="import-save">${full ? 'Guardar (sustituye la lista)' : 'Guardar'}</button><button type="button" class="btn" id="import-cancel">Descartar</button></div>
    ${full ? html`<p class="small muted">Al ser la lista de toda España, sustituye a la actual en este dispositivo: las que MAPFRE ha quitado dejan de dar tréboles. Para los demás móviles: «Publicar para todos» o «Descargar lista».</p>` : ''}`;
}

/** La lista que ves en este dispositivo: la compartida + lo importado aquí + tus marcas. */
function mergedList(state) {
  const merged = combineOfficial(state.serverOfficial, state.localOfficial);
  for (const [id, v] of Object.entries(state.settings.overrides)) {
    if (v === 'in' && !merged.stations[id]) merged.stations[id] = { tipo: 'manual', nombre: '' };
    if (v === 'out') delete merged.stations[id];
  }
  merged.updatedAt = new Date().toISOString().slice(0, 10);
  merged.source = 'Localizador de Club MAPFRE (mapfretecuidamos.com/gasolineras)';
  return merged;
}

function exportList(state) {
  const merged = mergedList(state);
  const url = URL.createObjectURL(new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'adheridas.json' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readImport(root) {
  const payloads = [];
  for (const f of root.querySelector('#import-file').files ?? []) {
    if (f.size > 200 * 1024 * 1024) throw new Error(`${f.name} es demasiado grande`);
    payloads.push(JSON.parse((await f.text()).replace(/^﻿/, '')));
  }
  const text = root.querySelector('#import-text').value.trim();
  if (text) payloads.push(JSON.parse(text));
  if (!payloads.length) throw new Error('Elige un fichero o pega la respuesta');
  return parseLocatorPayload(payloads);
}

const NF0 = new Intl.NumberFormat('es-ES');

/** Estado de los datos del servidor, en palabras. */
function dataStatus(st) {
  if (!st) return html`Sin conexión con el servidor: se muestran los últimos datos guardados.`;
  if (!st.ready) {
    return st.lastError
      ? html`Todavía no hay precios: el servidor no ha podido descargarlos del Ministerio (lo reintenta cada minuto).`
      : html`⏳ El servidor está descargando los precios del Ministerio (tarda un minuto al despertar).`;
  }
  return html`Precios del <b>${st.fecha}</b> · ${NF0.format(st.count)} gasolineras.
    ${st.prevDate ? html`<br>Comparación con ayer: precios del ${date(st.prevDate)}.` : ''}
    ${st.trendDays != null ? html`<br>Precio medio de la provincia: ${st.trendDays >= 14 ? 'últimos 14 días' : html`${st.trendDays} de 14 días descargados (se completa solo)`}.` : ''}`;
}

/** Días desde una fecha «aaaa-mm-dd». */
const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86400000) : null);

/**
 * Revisión automática de la lista (el servidor la hace con cada descarga del
 * Ministerio) y aviso si la lista del mapa oficial es vieja.
 */
function revisionHtml(server) {
  const r = server?.revision;
  const age = daysSince(server?.updatedAt);
  const changes = r ? r.corregidas + r.quitadas : 0;
  return html`
    ${r ? html`<p class="small">🔎 <b>Revisión automática</b> con los precios del Ministerio del ${r.fecha}: ${changes
      ? html`${r.corregidas ? `${r.corregidas} pasadas a su Repsol de verdad` : ''}${r.corregidas && r.quitadas ? ' y ' : ''}${r.quitadas ? `${r.quitadas} quitadas porque hoy tienen el rótulo de otra cadena` : ''}.`
      : 'todo en orden, ninguna adherida ha cambiado de cadena.'}</p>
      ${r.ejemplos?.length ? html`<details class="small"><summary>Ver cambios</summary><ul>${r.ejemplos.map((e) => html`<li>${e}</li>`)}</ul></details>` : ''}` : ''}
    ${age != null && age > 60 ? html`<p class="small warn">La lista del mapa oficial tiene ${age} días: conviene volver a importarla (abajo, «Importar del mapa oficial») por si MAPFRE ha añadido o quitado gasolineras.</p>` : ''}`;
}

const VERSION_TEXT = {
  same: '✓ Tienes la versión publicada.',
  outdated: 'Hay una versión nueva publicada: pulsa 🔄 Actualizar o cierra y vuelve a abrir la app.',
  ahead: 'Esta app es más nueva que la del servidor: esta versión aún no está publicada.',
  unknown: 'Sin conexión con el servidor: no se puede comparar con la publicada.',
};

/** Registro de cambios y versión instalada frente a la publicada. */
function changelogHtml(st) {
  const published = st?.version ?? null;
  const status = versionStatus(APP_VERSION, published);
  return html`
    <h3 id="novedades">Novedades y versión</h3>
    <p class="small">Esta app: <b>v${APP_VERSION}</b> · Publicada en el servidor: <b>${published ? `v${published}` : '—'}</b><br>
      <span class="${status === 'same' ? 'ok-text' : status === 'unknown' ? 'muted' : 'warn'}">${VERSION_TEXT[status]}</span></p>
    <div class="changelog small">
      <ol>${CHANGELOG.map((e) => html`
        <li class="${e.version === APP_VERSION ? 'current' : ''}">v${e.version} · ${date(e.date)}${e.version === APP_VERSION ? ' (la tuya)' : ''}${
          published && e.version === published && published !== APP_VERSION ? ' (publicada)' : ''}
          <ul>${e.changes.map((c) => html`<li>${c}</li>`)}</ul>
        </li>`)}</ol>
    </div>`;
}

export function renderSettings(ctx) {
  const { state } = ctx;
  const s = state.settings;
  const st = state.status;
  const root = document.getElementById('settings');

  root.innerHTML = html`
  <form id="settings-form" class="stack">
    <h3>Tus vehículos</h3>
    <p class="small muted">Cada vehículo tiene su carburante, los litros que sueles echar y su consumo (para el coste real: lo que pagas al llenar más lo que gastas en ir y volver). Con más de uno, aparece un selector junto a los filtros.</p>
    ${s.vehicles.map((v) => html`
      <fieldset class="rule vehicle-card ${v.id === s.vehicleId ? 'on' : ''}">
        <legend><label><input type="radio" name="vehicle-active" data-vsel="${v.id}" ${v.id === s.vehicleId ? 'checked' : ''}> <b>${v.icon} ${v.name}</b>${v.id === s.vehicleId ? ' (en uso)' : ''}</label></legend>
        <div class="row">
          <label class="field icon-field"><span>Icono</span><select data-v="${v.id}" data-vk="icon">${VEHICLE_ICONS.map((i) => html`<option ${i === v.icon ? 'selected' : ''}>${i}</option>`)}</select></label>
          <label class="field"><span>Nombre</span><input data-v="${v.id}" data-vk="name" value="${v.name}" maxlength="40"></label>
        </div>
        <div class="row">
          <label class="field"><span>Carburante</span><select data-v="${v.id}" data-vk="fuel">${FUELS.map((f) => html`<option value="${f.key}" ${f.key === v.fuel ? 'selected' : ''}>${f.label}</option>`)}</select></label>
          <label class="field"><span>Depósito (L)</span><input type="number" min="1" max="1000" step="1" data-v="${v.id}" data-vk="litres" value="${v.litres}"></label>
          <label class="field"><span>L/100 km</span><input type="number" min="1" max="50" step="0.1" data-v="${v.id}" data-vk="consumption" value="${v.consumption}"></label>
        </div>
        ${s.vehicles.length > 1 ? html`<button type="button" class="btn small" data-vdel="${v.id}">Eliminar</button>` : ''}
      </fieldset>`)}
    <button type="button" class="btn" id="add-vehicle">+ Añadir vehículo</button>

    ${cardSettingsHtml()}

    ${installSectionHtml()}

    ${backupSectionHtml()}

    ${officialSection(ctx)}

    <h3>Condiciones de Ahorro al Repostar</h3>
    <ul class="small conditions">
      <li><b>Con el carnet de socio</b>: <b>6 %</b> en tréboles del día 1 al 5 de cada mes y <b>3 %</b> el resto. 1 trébol = 1 € de descuento en tu seguro.</li>
      <li>Para canjear los tréboles necesitas al menos 5 y una póliza MAPFRE (coche, moto, hogar, salud…).</li>
      <li>Tope: compra máxima de <b>${s.program.cap?.perDay ?? 100} € al día</b> o <b>${s.program.cap?.perWeek ?? 300} € a la semana</b>.</li>
      <li>No dan tréboles el <b>GLP</b> ni el <b>GNC</b>, ni los vehículos de más de 3.500 kg de uso no particular.</li>
      <li>${s.program.requirement}</li>
      <li>No acumulable con otros descuentos de la estación (MundoGalp, Waylet, Club Moeve gow…).</li>
      <li>Oferta válida hasta el ${date(s.program.validUntil ?? DEFAULT_PROGRAM.validUntil)}.</li>
    </ul>
    <label class="field"><span>Valor de 1 trébol (€)</span><input type="number" min="0" max="5" step="0.05" data-k="trebolValue" value="${s.program.trebolValue}"></label>
    <p class="small muted">Si no vas a poder gastar los tréboles en tus seguros, pon un valor menor.</p>

    ${Object.keys(s.overrides).length ? html`<p class="small"><button type="button" class="btn small" id="clear-overrides">Borrar mis marcas manuales</button></p>` : ''}

    <h3>Filtros</h3>
    <label class="chip"><input type="checkbox" data-k="hideRestricted" ${s.hideRestricted ? 'checked' : ''}> Ocultar gasolineras de venta restringida (cooperativas, flotas)</label>
    ${s.hiddenBrands?.length
      ? html`<p class="small">🙈 Marcas que no quieres ver (toca una para volver a verla):</p>
        <div class="row wrap hidden-brands">${s.hiddenBrands.map((b) => html`<button type="button" class="btn small" data-unhide="${b}">${b.toUpperCase()} ✕</button>`)}</div>`
      : html`<p class="small muted">Para dejar de ver una marca, abre una de sus gasolineras y pulsa «🙈 Ocultar esta marca».</p>`}

    <h3>Datos</h3>
    <p class="small">Fuente: ${st?.source === 'demo' ? 'datos de DEMOSTRACIÓN (inventados)' : 'Ministerio para la Transición Ecológica (Geoportal de Hidrocarburos)'}.<br>
      ${dataStatus(st)}
      ${st?.lastError ? html`<br><span class="warn">Último error: ${st.lastError.message}</span>` : ''}</p>
    <p class="small muted">App no oficial, sin relación con MAPFRE. Comprueba las condiciones y las estaciones adheridas en la web de Club MAPFRE.</p>
    <div class="row wrap">
      <button type="button" class="btn" id="reset-settings">Restaurar ajustes de fábrica</button>
      <button type="button" class="btn danger" id="wipe">Borrar todos mis datos</button>
    </div>

    ${changelogHtml(st)}
  </form>`;

  root.querySelector('#settings-form').addEventListener('submit', (e) => e.preventDefault());
  bindCardSettings(root, ctx, () => renderSettings(ctx));
  bindBackup(root, ctx);
  root.querySelector('#install-app')?.addEventListener('click', async () => {
    if (await promptInstall()) ctx.toast('App instalada ✓');
    renderSettings(ctx);
  });

  const save = () => {
    ctx.persist();
    ctx.recompute();
    ctx.renderBoost();
  };
  const saveLocal = () => {
    saveLocalOfficial(state.localOfficial);
    ctx.setOfficial();
    renderSettings(ctx);
  };

  root.querySelectorAll('[data-unhide]').forEach((b) => b.addEventListener('click', () => {
    s.hiddenBrands = (s.hiddenBrands ?? []).filter((x) => x !== b.dataset.unhide);
    ctx.persist();
    ctx.recompute();
    renderSettings(ctx);
  }));
  root.querySelectorAll('[data-k]').forEach((el) =>
    el.addEventListener('change', () => {
      const k = el.dataset.k;
      if (el.type === 'checkbox') s[k] = el.checked;
      else if (k === 'trebolValue') s.program.trebolValue = Math.max(0, Number(el.value) || 0);
      else s[k] = Math.max(0, Number(el.value) || 0);
      if (k === 'hideRestricted') return ctx.reload();
      save();
    }),
  );
  // ---- Vehículos ----
  const afterVehicle = (fuelChanged) => {
    ctx.persist();
    if (fuelChanged) ctx.refetch();
    else { ctx.syncControls(); ctx.recompute(); }
    renderSettings(ctx);
  };
  root.querySelectorAll('[data-v]').forEach((el) =>
    el.addEventListener('change', () => {
      const before = s.fuel;
      updateVehicle(s, el.dataset.v, { [el.dataset.vk]: el.value });
      afterVehicle(s.fuel !== before);
    }),
  );
  root.querySelectorAll('[data-vsel]').forEach((el) =>
    el.addEventListener('change', () => {
      const before = s.fuel;
      selectVehicle(s, el.dataset.vsel);
      afterVehicle(s.fuel !== before);
    }),
  );
  root.querySelectorAll('[data-vdel]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!confirm('¿Eliminar este vehículo?')) return;
      const before = s.fuel;
      removeVehicle(s, b.dataset.vdel);
      afterVehicle(s.fuel !== before);
    }),
  );
  root.querySelector('#add-vehicle').addEventListener('click', () => {
    addVehicle(s, { name: 'Moto', icon: '🏍️', fuel: 'g95e5', litres: 12, consumption: 4 });
    afterVehicle(false);
  });

  root.querySelector('#clear-overrides')?.addEventListener('click', () => {
    if (!confirm('¿Borrar todas tus marcas manuales de adherida / no adherida?')) return;
    s.overrides = {};
    save();
    renderSettings(ctx);
  });

  // ---- Lista oficial ----
  root.querySelector('#export-list').addEventListener('click', () => exportList(state));
  root.querySelector('#publish-run')?.addEventListener('click', async (e) => {
    const out = root.querySelector('#publish-result');
    const key = root.querySelector('#publish-key').value;
    if (!key) {
      out.innerHTML = html`<p class="error">Escribe la clave de administrador.</p>`;
      return;
    }
    const list = mergedList(state);
    if (!confirm(`¿Publicar ${Object.keys(list.stations).length} gasolineras como lista para todos? Sustituye la lista compartida actual (${Object.keys(state.serverOfficial?.stations ?? {}).length}).`)) return;
    e.target.disabled = true;
    out.innerHTML = html`<p class="muted">Publicando…</p>`;
    try {
      const r = await ctx.api.publishOfficial({ key, list });
      state.serverOfficial = await ctx.api.adheridas();
      ctx.setOfficial();
      ctx.toast(`🌐 Lista publicada: ${r.stations} gasolineras para todos`, 5000);
      renderSettings(ctx);
      const res = document.getElementById('publish-result');
      if (res) res.innerHTML = html`<p class="small ${r.warning ? 'warn' : ''}">✓ Publicadas ${r.stations} gasolineras.
        ${r.github?.url ? html`Guardada en el repositorio (<a href="${r.github.url}" target="_blank" rel="noopener">ver cambio</a>); Render desplegará la versión nueva en unos minutos.` : ''}
        ${r.warning ?? ''}</p>`;
    } catch (err) {
      out.innerHTML = html`<p class="error">${err.message}</p>`;
      e.target.disabled = false;
    }
  });

  root.querySelector('#clear-local')?.addEventListener('click', () => {
    if (!confirm('¿Borrar la lista importada en este dispositivo? La lista compartida no se toca.')) return;
    state.localOfficial = emptyOfficial();
    saveLocal();
  });
  root.querySelector('#import-run').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await importEntries(ctx, readImport(root));
    } finally {
      e.target.disabled = false;
    }
  });
  bindImport(ctx, root);

  // Marcador «Enviar a Tréboles»: se arrastra a la barra de marcadores.
  const bm = bookmarklet(location.origin);
  const link = root.querySelector('#bookmarklet');
  link.setAttribute('href', bm);
  link.addEventListener('click', (e) => {
    e.preventDefault();
    ctx.toast('Arrástralo a la barra de marcadores y púlsalo en el mapa oficial de Club MAPFRE', 6000);
  });
  root.querySelector('#bookmarklet-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(bm);
      ctx.toast('Código copiado: crea un marcador nuevo y pégalo como dirección (URL)', 6000);
    } catch {
      prompt('Copia este código y pégalo como dirección (URL) de un marcador nuevo:', bm);
    }
  });

  root.querySelector('#reset-settings').addEventListener('click', () => {
    if (!confirm('¿Restaurar los ajustes de fábrica? Se mantienen favoritas, repostajes y la lista importada.')) return;
    state.settings = resetSettings(s);
    ctx.syncControls();
    ctx.reload();
    renderSettings(ctx);
  });
  root.querySelector('#wipe').addEventListener('click', () => {
    if (!confirm('¿Borrar ajustes, favoritas, repostajes y la lista importada de este dispositivo?')) return;
    try {
      Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    } catch { /* nada */ }
    location.reload();
  });
}

/**
 * Empareja gasolineras del mapa oficial (del marcador «Enviar a Tréboles» o de
 * un HAR) y enseña el resultado en «Actualizar la lista» para guardarlo.
 * @param {Array|Promise<Array>} entries estaciones leídas con parseLocatorPayload
 */
export async function importEntries(ctx, entries) {
  const out = () => document.getElementById('import-result');
  const show = (h) => {
    const el = out();
    if (el) {
      el.innerHTML = h;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  importing = true;
  lastImport = null;
  importError = null;
  show(WAITING);
  try {
    const list = await entries;
    if (!list.length) throw new Error('No se encontró ninguna gasolinera en los datos (¿has buscado en el mapa antes de guardar?)');
    lastImport = await ctx.api.matchOfficial(list);
    show(importResult(lastImport, ctx.state));
    bindImport(ctx, document);
  } catch (err) {
    importError = html`<p class="error">${err.message}</p>`;
    show(importError);
  } finally {
    importing = false;
  }
}

function bindImport(ctx, root) {
  const { state } = ctx;
  root.querySelector('#import-cancel')?.addEventListener('click', () => {
    lastImport = null;
    importError = null;
    root.querySelector('#import-result').innerHTML = '';
  });
  root.querySelector('#import-save')?.addEventListener('click', () => {
    if (!lastImport) return;
    const full = isFull(lastImport);
    // Toda España: sustituye a la lista anterior. Parcial: se suma.
    const local = full
      ? { ...emptyOfficial(), completa: true, source: 'Mapa oficial de Club MAPFRE', provinces: [...new Set([...(state.serverOfficial?.provinces ?? []), ...lastImport.provinces.map((p) => p.idProvincia)])].sort() }
      : state.localOfficial;
    for (const m of lastImport.matched) {
      local.stations[m.id] = { tipo: m.tipo, nombre: m.nombre, ...(m.ventajas ? { ventajas: m.ventajas } : {}) };
    }
    local.updatedAt = new Date().toISOString().slice(0, 10);
    state.localOfficial = local;
    const n = lastImport.matched.length;
    lastImport = null;
    saveLocalOfficial(local);
    ctx.setOfficial();
    ctx.toast(`Guardadas ${n} gasolineras adheridas 🍀`);
    renderSettings(ctx);
  });
}

