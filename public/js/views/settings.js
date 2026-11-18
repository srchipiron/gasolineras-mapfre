// Pestaña "Ajustes": repostaje, gasolineras adheridas, reglas y datos.

import { html, date } from '../format.js';
import { DEFAULT_PROGRAM, mergeOfficial, emptyOfficial, TIPOS } from '/shared/treboles.js';
import { parseLocatorPayload } from '/shared/locator.js';
import { REGIONES, provinciaName } from '/shared/provincias.js';
import { resetSettings, saveLocalOfficial, KEYS } from '../store.js';

let lastImport = null; // resultado del último emparejado, pendiente de guardar

function officialSection(ctx) {
  const { state } = ctx;
  const off = state.official ?? emptyOfficial();
  const server = state.serverOfficial ?? emptyOfficial();
  const local = state.localOfficial ?? emptyOfficial();
  const total = Object.keys(off.stations).length;
  const byTipo = {};
  for (const v of Object.values(off.stations)) byTipo[v.tipo] = (byTipo[v.tipo] ?? 0) + 1;
  const regionCodes = Object.values(REGIONES).flat();
  const codes = [...new Set([...regionCodes, ...off.provinces])];
  const ov = Object.values(state.settings.overrides);
  return html`
    <h3>Gasolineras adheridas a Club MAPFRE</h3>
    <p class="small">El mapa oficial de Club MAPFRE es la única fuente fiable. Donde importes su lista (o marques una provincia como revisada), solo cuentan las gasolineras de la lista; en el resto de España se usa la marca Repsol como aproximación.</p>
    <div class="kpis">
      <div class="kpi"><span class="label">Lista oficial</span><strong>${total}</strong><span class="small">${Object.entries(byTipo).map(([t, n]) => `${n} ${TIPOS[t] ?? t}`).join(' · ') || 'sin importar'}</span></div>
      <div class="kpi"><span class="label">Provincias completas</span><strong>${off.provinces.length}</strong><span class="small">${off.provinces.map(provinciaName).join(', ') || '—'}</span></div>
      <div class="kpi"><span class="label">Marcadas a mano</span><strong>${ov.filter((v) => v === 'in').length} / ${ov.filter((v) => v === 'out').length}</strong><span class="small">adheridas / no adheridas</span></div>
    </div>
    ${server.updatedAt ? html`<p class="small muted">Lista compartida actualizada el ${date(server.updatedAt)} (${Object.keys(server.stations).length} gasolineras). Importadas en este dispositivo: ${Object.keys(local.stations).length}.</p>` : ''}

    <label class="chip"><input type="checkbox" data-k="markMode" ${state.settings.markMode ? 'checked' : ''}> Modo marcar: botón «＋ Adherida» / «✓ Adherida» en cada gasolinera de la lista</label>

    <fieldset class="rule on">
      <legend><b>Importar del mapa oficial</b></legend>
      <label class="field"><span>Fichero HAR o JSON guardado desde el mapa oficial</span>
        <input type="file" id="import-file" accept=".har,.json,application/json" multiple></label>
      <label class="field"><span>…o pega aquí la respuesta copiada</span>
        <textarea id="import-text" rows="3" placeholder='{"message":{"contenido":[...]}}'></textarea></label>
      <button type="button" class="btn primary" id="import-run">Leer y emparejar</button>
      <div id="import-result">${lastImport ? importResult(lastImport) : ''}</div>
      <details class="small">
        <summary>Cómo sacar la lista del mapa oficial (ordenador, Chrome o Edge)</summary>
        <ol>
          <li>Abre <a href="${DEFAULT_PROGRAM.officialMapUrl}" target="_blank" rel="noopener">el mapa oficial de Club MAPFRE</a>.</li>
          <li>Pulsa <b>F12</b> y ve a la pestaña <b>Red</b> (Network). Déjala abierta.</li>
          <li>En el buscador del mapa, busca una a una las ciudades de la zona: Almería, Cádiz, Jerez, Algeciras, Córdoba, Granada, Motril, Huelva, Jaén, Linares, Málaga, Marbella, Antequera, Sevilla, Écija, Murcia, Cartagena, Lorca… Cada búsqueda descarga las gasolineras de alrededor.</li>
          <li>En la pestaña Red, haz clic derecho sobre cualquier petición y elige <b>Guardar todo como HAR</b> (Save all as HAR).</li>
          <li>Aquí, elige ese fichero y pulsa «Leer y emparejar». Revisa el resultado y pulsa «Guardar».</li>
        </ol>
        <p>El fichero se lee en tu navegador: al servidor solo se envían las posiciones y nombres de las gasolineras, nunca tus cookies ni tus datos.</p>
      </details>
    </fieldset>

    <fieldset class="rule">
      <legend><b>Provincias revisadas por completo</b></legend>
      <p class="small muted">Marca una provincia cuando tengas todas sus gasolineras adheridas (importadas o marcadas a mano). En ella dejarán de contar las Repsol que no estén en la lista.</p>
      ${Object.entries(REGIONES).map(([region, list]) => html`
        <div class="row wrap"><b class="small">${region}</b>
          <button type="button" class="btn small" data-region="${region}">Marcar todas</button></div>`)}
      <div class="prov-grid">
        ${codes.sort().map((c) => {
          const fromServer = server.provinces.includes(c);
          const checked = fromServer || local.provinces.includes(c);
          return html`<label class="chip small"><input type="checkbox" data-prov="${c}" ${checked ? 'checked' : ''} ${fromServer ? 'disabled' : ''}> ${provinciaName(c)}</label>`;
        })}
      </div>
    </fieldset>

    <div class="row wrap">
      <button type="button" class="btn" id="export-list">Descargar lista (adheridas.json)</button>
      ${Object.keys(local.stations).length || local.provinces.length ? html`<button type="button" class="btn danger" id="clear-local">Borrar lo importado aquí</button>` : ''}
    </div>
    <p class="small muted">«Descargar lista» une la lista compartida, lo importado aquí y tus marcas. Pásame ese fichero y lo subo al repositorio para que lo veas en todos tus dispositivos.</p>`;
}

function importResult(r) {
  return html`
    <p><b>${r.matched.length}</b> gasolineras emparejadas de ${r.received} leídas${r.unmatched.length ? html`, <b>${r.unmatched.length}</b> sin emparejar` : ''}.</p>
    <table class="prices">
      <thead><tr><th>Provincia</th><th>Adheridas</th><th>Completa</th></tr></thead>
      <tbody>${r.provinces.map((p) => html`<tr><td>${provinciaName(p.idProvincia)}</td><td>${p.count} de ${p.total}</td>
        <td><input type="checkbox" data-import-prov="${p.idProvincia}" ${p.complete ? 'checked' : ''} aria-label="Lista completa de ${provinciaName(p.idProvincia)}"></td></tr>`)}</tbody>
    </table>
    ${r.unmatched.length ? html`<details class="small"><summary>Ver las ${r.unmatched.length} sin emparejar</summary><ul>${r.unmatched.slice(0, 100).map((u) => html`<li>${u.nombre} · ${u.direccion}, ${u.localidad}</li>`)}</ul></details>` : ''}
    <div class="row wrap"><button type="button" class="btn primary" id="import-save">Guardar</button><button type="button" class="btn" id="import-cancel">Descartar</button></div>`;
}

function exportList(state) {
  const merged = mergeOfficial(state.serverOfficial, state.localOfficial);
  for (const [id, v] of Object.entries(state.settings.overrides)) {
    if (v === 'in' && !merged.stations[id]) merged.stations[id] = { tipo: 'manual', nombre: '' };
    if (v === 'out') delete merged.stations[id];
  }
  merged.updatedAt = new Date().toISOString().slice(0, 10);
  merged.source = 'Localizador de Club MAPFRE (mapfretecuidamos.com/gasolineras)';
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

export function renderSettings(ctx) {
  const { state } = ctx;
  const s = state.settings;
  const st = state.status;
  const isDefault = (id) => DEFAULT_PROGRAM.rules.some((r) => r.id === id);
  const root = document.getElementById('settings');

  root.innerHTML = html`
  <form id="settings-form" class="stack">
    <h3>Tu repostaje</h3>
    <div class="row">
      <label class="field"><span>Litros por repostaje</span><input type="number" min="1" max="1000" step="1" data-k="litres" value="${s.litres}"></label>
      <label class="field"><span>Consumo (L/100 km)</span><input type="number" min="1" max="50" step="0.1" data-k="consumption" value="${s.consumption}"></label>
    </div>
    <p class="small muted">Se usan para calcular el coste real: lo que pagas al llenar más el combustible que gastas en ir y volver.</p>

    ${officialSection(ctx)}

    <h3>Condiciones de Ahorro al Repostar</h3>
    <ul class="small conditions">
      <li><b>6 %</b> en tréboles del día 1 al 5 de cada mes y <b>3 %</b> el resto. 1 trébol = 1 € de descuento en tu seguro.</li>
      <li>Tope: compra máxima de <b>${s.program.cap?.perDay ?? 100} € al día</b> o <b>${s.program.cap?.perWeek ?? 300} € a la semana</b>.</li>
      <li>No dan tréboles el <b>GLP</b> ni el <b>GNC</b>, ni los vehículos de más de 3.500 kg de uso no particular.</li>
      <li>${s.program.requirement}</li>
      <li>No acumulable con otros descuentos de la estación (MundoGalp, Waylet, Club Moeve gow…).</li>
      <li>Oferta válida hasta el ${date(s.program.validUntil ?? DEFAULT_PROGRAM.validUntil)}.</li>
    </ul>
    <label class="field"><span>Valor de 1 trébol (€)</span><input type="number" min="0" max="5" step="0.05" data-k="trebolValue" value="${s.program.trebolValue}"></label>
    <p class="small muted">Si no vas a poder gastar los tréboles en tus seguros, pon un valor menor.</p>

    <h3>Reglas por marca (donde no hay lista oficial)</h3>
    ${s.program.rules.map((r, i) => html`
      <fieldset class="rule ${r.enabled ? 'on' : ''}">
        <legend><label><input type="checkbox" data-rule="${i}" data-rk="enabled" ${r.enabled ? 'checked' : ''}> <b>${r.name}</b></label></legend>
        ${r.requirement ? html`<p class="small muted">${r.requirement}</p>` : ''}
        ${!isDefault(r.id) ? html`<label class="field"><span>Nombre</span><input data-rule="${i}" data-rk="name" value="${r.name}"></label>` : ''}
        <label class="field"><span>Rótulos que cuentan (separados por comas)</span><input data-rule="${i}" data-rk="match" value="${(r.match ?? []).join(', ')}"></label>
        <div class="row">
          <label class="field"><span>% normal</span><input type="number" step="0.5" min="0" max="100" data-rule="${i}" data-rk="percent" value="${r.percent}"></label>
          <label class="field"><span>% bonificado</span><input type="number" step="0.5" min="0" max="100" data-rule="${i}" data-rk="boostPercent" value="${r.boostPercent}"></label>
          <label class="field"><span>Días</span>
            <span class="days"><input type="number" min="1" max="31" data-rule="${i}" data-rk="boostFromDay" value="${r.boostFromDay}"> a
            <input type="number" min="0" max="31" data-rule="${i}" data-rk="boostToDay" value="${r.boostToDay}"></span>
          </label>
        </div>
        ${!isDefault(r.id) ? html`<button type="button" class="btn small" data-del-rule="${i}">Eliminar regla</button>` : ''}
      </fieldset>`)}
    <button type="button" class="btn" id="add-rule">+ Añadir otra marca</button>
    ${Object.keys(s.overrides).length ? html`<p class="small"><button type="button" class="btn small" id="clear-overrides">Borrar mis marcas manuales</button></p>` : ''}

    <h3>Filtros</h3>
    <label class="chip"><input type="checkbox" data-k="hideRestricted" ${s.hideRestricted ? 'checked' : ''}> Ocultar gasolineras de venta restringida (cooperativas, flotas)</label>

    <h3>Datos</h3>
    <p class="small">Fuente: ${st?.source === 'demo' ? 'datos de DEMOSTRACIÓN (inventados)' : 'Ministerio para la Transición Ecológica (Geoportal de Hidrocarburos)'}.<br>
      Última actualización: ${st?.fecha ?? '—'} · ${st?.count ?? 0} gasolineras.
      ${st?.lastError ? html`<br><span class="warn">Último error: ${st.lastError.message}</span>` : ''}</p>
    <p class="small muted">App no oficial, sin relación con MAPFRE. Comprueba las condiciones y las estaciones adheridas en la web de Club MAPFRE.</p>
    <div class="row wrap">
      <button type="button" class="btn" id="reset-settings">Restaurar ajustes de fábrica</button>
      <button type="button" class="btn danger" id="wipe">Borrar todos mis datos</button>
    </div>
  </form>`;

  root.querySelector('#settings-form').addEventListener('submit', (e) => e.preventDefault());

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
  root.querySelectorAll('[data-rule]').forEach((el) =>
    el.addEventListener('change', () => {
      const r = s.program.rules[Number(el.dataset.rule)];
      const k = el.dataset.rk;
      if (k === 'enabled') r.enabled = el.checked;
      else if (k === 'match') r.match = el.value.split(',').map((x) => x.trim()).filter(Boolean);
      else if (k === 'name') r.name = el.value.trim() || 'Otra marca';
      else r[k] = Math.max(0, Number(el.value) || 0);
      save();
      if (k === 'enabled') renderSettings(ctx);
    }),
  );
  root.querySelectorAll('[data-del-rule]').forEach((b) =>
    b.addEventListener('click', () => {
      s.program.rules.splice(Number(b.dataset.delRule), 1);
      save();
      renderSettings(ctx);
    }),
  );
  root.querySelector('#add-rule').addEventListener('click', () => {
    s.program.rules.push({
      id: `custom-${Date.now()}`, name: 'Otra marca', match: [], percent: 3, boostPercent: 6,
      boostFromDay: 1, boostToDay: 5, enabled: true, requirement: 'Regla añadida por ti.',
    });
    save();
    renderSettings(ctx);
  });
  root.querySelector('#clear-overrides')?.addEventListener('click', () => {
    if (!confirm('¿Borrar todas tus marcas manuales de adherida / no adherida?')) return;
    s.overrides = {};
    save();
    renderSettings(ctx);
  });

  // ---- Lista oficial ----
  root.querySelectorAll('[data-prov]').forEach((el) =>
    el.addEventListener('change', () => {
      const set = new Set(state.localOfficial.provinces);
      if (el.checked) set.add(el.dataset.prov);
      else set.delete(el.dataset.prov);
      state.localOfficial.provinces = [...set].sort();
      saveLocal();
    }),
  );
  root.querySelectorAll('[data-region]').forEach((b) =>
    b.addEventListener('click', () => {
      const set = new Set(state.localOfficial.provinces);
      REGIONES[b.dataset.region].forEach((p) => set.add(p));
      state.localOfficial.provinces = [...set].sort();
      saveLocal();
    }),
  );
  root.querySelector('#export-list').addEventListener('click', () => exportList(state));
  root.querySelector('#clear-local')?.addEventListener('click', () => {
    if (!confirm('¿Borrar la lista importada en este dispositivo? La lista compartida no se toca.')) return;
    state.localOfficial = emptyOfficial();
    saveLocal();
  });
  root.querySelector('#import-run').addEventListener('click', async (e) => {
    const out = root.querySelector('#import-result');
    e.target.disabled = true;
    out.innerHTML = html`<p class="muted">Leyendo…</p>`;
    try {
      const entries = await readImport(root);
      if (!entries.length) throw new Error('No se encontró ninguna gasolinera en los datos (¿has buscado en el mapa antes de guardar?)');
      const res = await ctx.api.matchOfficial(entries);
      // Se propone como "completa" una provincia si tiene al menos 10 adheridas.
      res.provinces = res.provinces.map((p) => ({ ...p, complete: p.count >= 10 }));
      lastImport = res;
      out.innerHTML = importResult(res);
      bindImport(ctx, root);
    } catch (err) {
      out.innerHTML = html`<p class="error">${err.message}</p>`;
    } finally {
      e.target.disabled = false;
    }
  });
  bindImport(ctx, root);

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

function bindImport(ctx, root) {
  const { state } = ctx;
  root.querySelector('#import-cancel')?.addEventListener('click', () => {
    lastImport = null;
    root.querySelector('#import-result').innerHTML = '';
  });
  root.querySelector('#import-save')?.addEventListener('click', () => {
    if (!lastImport) return;
    const local = state.localOfficial;
    for (const m of lastImport.matched) local.stations[m.id] = { tipo: m.tipo, nombre: m.nombre };
    const set = new Set(local.provinces);
    root.querySelectorAll('[data-import-prov]').forEach((el) => {
      if (el.checked) set.add(el.dataset.importProv);
    });
    local.provinces = [...set].sort();
    local.updatedAt = new Date().toISOString().slice(0, 10);
    const n = lastImport.matched.length;
    lastImport = null;
    saveLocalOfficial(local);
    ctx.setOfficial();
    ctx.toast(`Guardadas ${n} gasolineras adheridas 🍀`);
    renderSettings(ctx);
  });
}

