// Pestaña "Favoritas": precios actuales y aviso de precio objetivo.

import { html, eurL, km } from '../format.js';
import { enrich } from '/shared/ranking.js';
import { haversineKm } from '/shared/geo.js';
import { fuelLabel } from '/shared/fuels.js';
import { saveFavorites } from '../store.js';

async function currentResults(ctx) {
  const { state, api } = ctx;
  const s = state.settings;
  const ids = state.favorites.map((f) => f.id);
  if (!ids.length) return new Map();
  const { stations } = await api.byIds(ids);
  const c = state.center;
  const withDist = stations.map((st) => ({
    ...st,
    distanceKm: c ? haversineKm(c.lat, c.lon, st.lat, st.lon) : undefined,
  }));
  const results = enrich(withDist, {
    fuel: s.fuel, program: s.program, overrides: s.overrides, litres: s.litres, consumption: s.consumption,
  });
  return new Map(results.map((r) => [r.station.id, r]));
}

export async function renderFavorites(ctx) {
  const { state } = ctx;
  const list = document.getElementById('favorites');
  if (!state.favorites.length) {
    list.innerHTML = html`<li class="empty">No tienes gasolineras favoritas todavía.</li>`;
    return;
  }
  list.innerHTML = html`<li class="empty">Cargando precios…</li>`;
  let byId;
  try {
    byId = await currentResults(ctx);
  } catch (err) {
    list.innerHTML = html`<li class="empty">No se pudieron cargar los precios: ${err.message}</li>`;
    return;
  }
  list.innerHTML = html`${state.favorites.map((f) => {
    const r = byId.get(f.id);
    const hit = r && f.target != null && r.effective <= f.target;
    return html`
    <li class="result fav ${r?.mapfre ? 'is-mapfre' : ''} ${hit ? 'hit' : ''}" data-id="${f.id}">
      <div class="info" data-open="${f.id}" tabindex="0">
        <div class="title"><strong>${f.brand}</strong>
          ${r?.mapfre ? html`<span class="badge mapfre">🍀 ${r.percent} %</span>` : ''}
          ${hit ? html`<span class="badge ok">🔔 Por debajo de tu objetivo</span>` : ''}
        </div>
        <div class="addr">${f.address} · ${f.locality}</div>
        <div class="meta">${r ? `${fuelLabel(state.settings.fuel)}${r.station.distanceKm != null ? ` · ${km(r.station.distanceKm)}` : ''}` : `Sin precio de ${fuelLabel(state.settings.fuel)}`}</div>
      </div>
      <div class="price">
        <div class="eff">${r ? eurL(r.effective) : '—'}</div>
        ${r?.mapfre ? html`<div class="pump">surtidor ${eurL(r.price)}</div>` : ''}
        <label class="target">Avisar si baja de
          <input type="number" step="0.001" min="0" inputmode="decimal" data-target="${f.id}" value="${f.target ?? ''}" placeholder="1,450">
        </label>
        <button class="btn small" data-remove="${f.id}">Quitar</button>
      </div>
    </li>`;
  })}`;

  list.querySelectorAll('[data-open]').forEach((el) => {
    const open = () => ctx.openDetailById(el.dataset.open);
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => e.key === 'Enter' && open());
  });
  list.querySelectorAll('[data-target]').forEach((inp) =>
    inp.addEventListener('change', () => {
      const v = inp.value === '' ? null : Number(String(inp.value).replace(',', '.'));
      state.favorites = state.favorites.map((f) => (f.id === inp.dataset.target ? { ...f, target: Number.isFinite(v) ? v : null } : f));
      saveFavorites(state.favorites);
      renderFavorites(ctx);
    }),
  );
  list.querySelectorAll('[data-remove]').forEach((b) =>
    b.addEventListener('click', () => {
      state.favorites = state.favorites.filter((f) => f.id !== b.dataset.remove);
      saveFavorites(state.favorites);
      renderFavorites(ctx);
      ctx.recompute();
    }),
  );
}

/** Al abrir la app: avisa de las favoritas que están por debajo de su objetivo. */
export async function checkAlerts(ctx) {
  const withTarget = ctx.state.favorites.filter((f) => f.target != null);
  if (!withTarget.length) return;
  try {
    const byId = await currentResults(ctx);
    const hits = withTarget
      .map((f) => ({ f, r: byId.get(f.id) }))
      .filter(({ f, r }) => r && r.effective <= f.target);
    if (hits.length) {
      ctx.toast(`🔔 ${hits.map(({ f, r }) => `${f.brand} ${f.locality}: ${eurL(r.effective)}`).join(' · ')}`, 8000);
    }
  } catch {
    /* sin conexión: no pasa nada */
  }
}
