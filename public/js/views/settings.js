// Pestaña "Ajustes": repostaje, reglas de Club MAPFRE y datos.

import { html, date } from '../format.js';
import { DEFAULT_PROGRAM } from '/shared/treboles.js';
import { resetSettings } from '../store.js';

export function renderSettings(ctx) {
  const { state } = ctx;
  const s = state.settings;
  const st = state.status;
  const ovIn = Object.values(s.overrides).filter((v) => v === 'in').length;
  const ovOut = Object.values(s.overrides).filter((v) => v === 'out').length;
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

    <h3>Club MAPFRE · Ahorro al Repostar</h3>
    <label class="field"><span>Valor de 1 trébol (€)</span><input type="number" min="0" max="5" step="0.05" data-k="trebolValue" value="${s.program.trebolValue}"></label>
    <p class="small muted">Club MAPFRE da 1 € de descuento en tu seguro por cada trébol. Si no vas a poder gastarlos, pon un valor menor.</p>
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
    <button type="button" class="btn" id="add-rule">+ Añadir otra marca adherida</button>
    <p class="small">Estaciones marcadas a mano: <b>${ovIn}</b> adheridas, <b>${ovOut}</b> no adheridas.
      ${ovIn + ovOut ? html`<button type="button" class="btn small" id="clear-overrides">Borrar marcas</button>` : ''}</p>

    <h3>Filtros</h3>
    <label class="chip"><input type="checkbox" data-k="hideRestricted" ${s.hideRestricted ? 'checked' : ''}> Ocultar gasolineras de venta restringida (cooperativas, flotas)</label>

    <h3>Datos</h3>
    <p class="small">Fuente: ${st?.source === 'demo' ? 'datos de DEMOSTRACIÓN (inventados)' : 'Ministerio para la Transición Ecológica (Geoportal de Hidrocarburos)'}.<br>
      Última actualización: ${st?.fecha ?? '—'} · ${st?.count ?? 0} gasolineras.
      ${st?.lastError ? html`<br><span class="warn">Último error: ${st.lastError.message}</span>` : ''}</p>
    <p class="small muted">Condiciones de Club MAPFRE según su web (válidas hasta ${date(s.program.validUntil ?? DEFAULT_PROGRAM.validUntil)}). Las estaciones adheridas pueden cambiar: compruébalas en el localizador oficial de Club MAPFRE. App no oficial, sin relación con MAPFRE.</p>
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
    s.overrides = {};
    save();
    renderSettings(ctx);
  });
  root.querySelector('#reset-settings').addEventListener('click', () => {
    if (!confirm('¿Restaurar los ajustes de fábrica? Se mantienen favoritas y repostajes.')) return;
    state.settings = resetSettings(s);
    ctx.syncControls();
    ctx.reload();
    renderSettings(ctx);
  });
  root.querySelector('#wipe').addEventListener('click', () => {
    if (!confirm('¿Borrar ajustes, favoritas y repostajes de este dispositivo?')) return;
    try {
      ['gm.settings.v1', 'gm.favorites.v1', 'gm.log.v1'].forEach((k) => localStorage.removeItem(k));
    } catch { /* nada */ }
    location.reload();
  });
}
