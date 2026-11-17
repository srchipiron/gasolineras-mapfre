// Pestaña "Repostajes": historial, tréboles acumulados y exportación CSV.

import { html, eur, num2, eurL, date, todayISO } from '../format.js';
import { fuelLabel } from '/shared/fuels.js';
import { saveLog } from '../store.js';

function totals(entries) {
  return entries.reduce(
    (t, e) => ({ amount: t.amount + e.amount, litres: t.litres + e.litres, treboles: t.treboles + (e.treboles || 0), n: t.n + 1 }),
    { amount: 0, litres: 0, treboles: 0, n: 0 },
  );
}

export function renderLog(ctx) {
  const { state } = ctx;
  const today = todayISO();
  const month = totals(state.log.filter((e) => e.date.startsWith(today.slice(0, 7))));
  const year = totals(state.log.filter((e) => e.date.startsWith(today.slice(0, 4))));
  const all = totals(state.log);
  const card = (t, title) => html`
    <div class="kpi">
      <span class="label">${title}</span>
      <strong>${num2(t.treboles)} 🍀</strong>
      <span class="small">${eur(t.amount)} · ${num2(t.litres)} L · ${t.n} ${t.n === 1 ? 'repostaje' : 'repostajes'}</span>
      <span class="small muted">${t.litres ? `Media ${eurL(t.amount / t.litres)}/L` : ''}</span>
    </div>`;
  document.getElementById('log-summary').innerHTML = html`
    <div class="kpis">
      ${card(month, 'Este mes')}
      ${card(year, `Año ${today.slice(0, 4)}`)}
      ${card(all, 'Total')}
    </div>`;

  const list = document.getElementById('log-list');
  if (!state.log.length) {
    list.innerHTML = html`<li class="empty">Aún no has registrado repostajes. Abre una gasolinera y pulsa «Registrar repostaje», o usa «+ Añadir repostaje».</li>`;
    return;
  }
  list.innerHTML = html`${state.log.map((e) => html`
    <li class="log-item">
      <div>
        <strong>${e.name || 'Repostaje'}</strong>
        <div class="small muted">${date(e.date)} · ${fuelLabel(e.fuel)} · ${num2(e.litres)} L a ${eurL(e.price)}</div>
      </div>
      <div class="right">
        <strong>${eur(e.amount)}</strong>
        <div class="small">${e.mapfre ? `+${num2(e.treboles)} 🍀 (${num2(e.percent)} %)` : 'sin tréboles'}</div>
      </div>
      <button class="btn icon small" data-del="${e.id}" aria-label="Borrar repostaje">🗑</button>
    </li>`)}`;
  list.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!confirm('¿Borrar este repostaje?')) return;
      state.log = state.log.filter((e) => e.id !== b.dataset.del);
      saveLog(state.log);
      renderLog(ctx);
    }),
  );
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const dec = (n, d) => (Number(n) || 0).toFixed(d).replace('.', ',');

export function exportLogCsv(state) {
  const header = ['fecha', 'gasolinera', 'carburante', 'litros', 'precio_litro', 'importe', 'club_mapfre', 'porcentaje', 'treboles'];
  const rows = state.log.map((e) => [
    e.date, e.name, fuelLabel(e.fuel), dec(e.litres, 2), dec(e.price, 3), dec(e.amount, 2),
    e.mapfre ? 'sí' : 'no', dec(e.percent, 1), dec(e.treboles, 2),
  ]);
  const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `repostajes-${todayISO()}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
