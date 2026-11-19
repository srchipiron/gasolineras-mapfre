// Pestaña "Repostajes": historial, tréboles acumulados, tope de 100 €/300 €,
// confirmación de que llegaron los tréboles y exportación CSV.

import { html, raw, eur, eur0, num2, eurL, date, todayISO } from '../format.js';
import { fuelLabel } from '/shared/fuels.js';
import { capStatus, trebolStatus } from '/shared/treboles.js';
import { saveLog } from '../store.js';
import { payerOf, splitByPayer } from '/shared/modo.js';

function totals(entries) {
  const t = entries.reduce(
    (t, e) => ({ amount: t.amount + e.amount, litres: t.litres + e.litres, treboles: t.treboles + (e.treboles || 0), n: t.n + 1 }),
    { amount: 0, litres: 0, treboles: 0, n: 0 },
  );
  // Lo que salió de tu bolsillo y lo que pagó la empresa (los tréboles, tuyos).
  return { ...t, ...splitByPayer(entries) };
}

function capBar(label, part) {
  if (!part.cap) return '';
  const pctUsed = Math.min(100, (part.used / part.cap) * 100);
  return html`<div class="cap">
    <div class="row cap-row"><span class="small">${label}</span><span class="small"><b>${eur0(part.left)}</b> libres de ${eur0(part.cap)}</span></div>
    <div class="bar"><span style="width:${pctUsed.toFixed(0)}%"></span></div>
  </div>`;
}

function monthlyChart(log, today) {
  const months = [];
  const d = new Date(`${today}T12:00:00`);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  const vals = months.map((m) => log.filter((e) => e.date.startsWith(m)).reduce((s, e) => s + (e.treboles || 0), 0));
  const max = Math.max(...vals, 1);
  if (vals.every((v) => v === 0)) return '';
  const w = 300, h = 110, bw = 34, gap = (w - bw * 6) / 7;
  const label = (m) => new Date(`${m}-15T12:00:00`).toLocaleDateString('es-ES', { month: 'short' });
  return `<svg class="chart bars" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tréboles por mes">
    ${vals.map((v, i) => {
      const bh = (v / max) * (h - 34);
      const x = gap + i * (bw + gap);
      return `<rect x="${x.toFixed(1)}" y="${(h - 18 - bh).toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="4"><title>${num2(v)} tréboles</title></rect>
        <text class="axis" x="${(x + bw / 2).toFixed(1)}" y="${h - 4}" text-anchor="middle">${label(months[i])}</text>
        ${v > 0 ? `<text class="axis val" x="${(x + bw / 2).toFixed(1)}" y="${(h - 22 - bh).toFixed(1)}" text-anchor="middle">${num2(v)}</text>` : ''}`;
    }).join('')}
  </svg>`;
}

export function renderLog(ctx) {
  const { state } = ctx;
  const today = todayISO();
  const month = totals(state.log.filter((e) => e.date.startsWith(today.slice(0, 7))));
  const year = totals(state.log.filter((e) => e.date.startsWith(today.slice(0, 4))));
  const all = totals(state.log);
  const cap = capStatus(today, state.log, state.settings.program);
  const pending = state.log.filter((e) => trebolStatus(e, today)?.kind === 'ask');
  const card = (t, title) => html`
    <div class="kpi">
      <span class="label">${title}</span>
      <strong>${num2(t.treboles)} 🍀</strong>
      <span class="small">${eur(t.amount)} · ${num2(t.litres)} L · ${t.n} ${t.n === 1 ? 'repostaje' : 'repostajes'}</span>
      ${t.company > 0 ? html`<span class="small">🚗 Tú ${eur(t.personal)} · 💼 Empresa ${eur(t.company)}</span>` : ''}
      <span class="small muted">${t.litres ? `Media ${eurL(t.amount / t.litres)}/L` : ''}</span>
    </div>`;
  document.getElementById('log-summary').innerHTML = html`
    <div class="kpis">
      ${card(month, 'Este mes')}
      ${card(year, `Año ${today.slice(0, 4)}`)}
      ${card(all, 'Total')}
    </div>
    <div class="caps">
      ${capBar('Tope con tréboles hoy', cap.day)}
      ${capBar('Tope esta semana (lunes a domingo)', cap.week)}
    </div>
    ${pending.length ? html`<p class="verdict bad">Tienes ${pending.length} ${pending.length === 1 ? 'repostaje' : 'repostajes'} con más de 10 días: confirma abajo si te llegaron los tréboles.</p>` : ''}
    ${raw(monthlyChart(state.log, today))}`;

  const list = document.getElementById('log-list');
  if (!state.log.length) {
    list.innerHTML = html`<li class="empty">Aún no has registrado repostajes. Abre una gasolinera y pulsa «Registrar repostaje», o usa «+ Añadir repostaje».</li>`;
    return;
  }
  list.innerHTML = html`${state.log.map((e) => {
    const st = trebolStatus(e, today);
    return html`
    <li class="log-item ${st?.kind === 'ask' ? 'ask' : ''}">
      <div>
        <strong>${e.name || 'Repostaje'}</strong>${payerOf(e) === 'company' ? html`<span class="log-payer">💼 Empresa</span>` : ''}
        <div class="small muted">${date(e.date)} · ${fuelLabel(e.fuel)} · ${num2(e.litres)} L a ${eurL(e.price)}</div>
        ${st?.kind === 'waiting' ? html`<div class="small muted">Los tréboles llegan antes del ${date(st.until)}.</div>` : ''}
        ${st?.kind === 'ok' ? html`<div class="small ok-text">✓ Tréboles recibidos</div>` : ''}
        ${st?.kind === 'ask' ? html`<div class="small">¿Te llegaron los ${num2(e.treboles)} tréboles?
          <button type="button" class="btn small" data-confirm="${e.id}" data-v="yes">Sí</button>
          <button type="button" class="btn small" data-confirm="${e.id}" data-v="no">No</button></div>` : ''}
        ${st?.kind === 'claim' ? html`<div class="small warn">${st.left > 0
          ? html`Reclámalos en el Área de Clientes de Club MAPFRE antes del ${date(st.claimUntil)} (quedan ${st.left} días). Indica la gasolinera, el motivo y, si pagaste con tarjeta, tu banco; te pedirán el ticket original.`
          : 'Ya pasaron los 30 días para reclamar estos tréboles.'}</div>` : ''}
      </div>
      <div class="right">
        <strong>${eur(e.amount)}</strong>
        <div class="small">${e.mapfre ? `+${num2(e.treboles)} 🍀 (${num2(e.percent)} %)` : 'sin tréboles'}</div>
      </div>
      <button class="btn icon small" data-del="${e.id}" aria-label="Borrar repostaje">🗑</button>
    </li>`;
  })}`;
  list.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!confirm('¿Borrar este repostaje?')) return;
      state.log = state.log.filter((e) => e.id !== b.dataset.del);
      saveLog(state.log);
      renderLog(ctx);
      ctx.recompute();
    }),
  );
  list.querySelectorAll('[data-confirm]').forEach((b) =>
    b.addEventListener('click', () => {
      const yes = b.dataset.v === 'yes';
      const entry = state.log.find((e) => e.id === b.dataset.confirm);
      if (!entry) return;
      entry.confirmed = yes;
      saveLog(state.log);
      // Si los tréboles llegaron, la gasolinera está adherida de verdad.
      if (yes && entry.stationId && state.notes[entry.stationId]?.verdict !== 'ok') {
        ctx.setVerdict({ id: entry.stationId }, 'ok');
      }
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
  const header = ['fecha', 'gasolinera', 'carburante', 'litros', 'precio_litro', 'importe', 'club_mapfre', 'porcentaje', 'importe_con_treboles', 'treboles', 'treboles_recibidos', 'paga'];
  const rows = state.log.map((e) => [
    e.date, e.name, fuelLabel(e.fuel), dec(e.litres, 2), dec(e.price, 3), dec(e.amount, 2),
    e.mapfre ? 'sí' : 'no', dec(e.percent, 1), dec(e.eligibleAmount ?? (e.mapfre ? e.amount : 0), 2), dec(e.treboles, 2),
    e.confirmed === true ? 'sí' : e.confirmed === false ? 'no' : '',
    payerOf(e) === 'company' ? 'empresa' : 'yo',
  ]);
  const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `repostajes-${todayISO()}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
