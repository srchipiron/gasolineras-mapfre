// Pestaña "Repostajes": historial, tréboles acumulados, tope de 100 €/300 €,
// confirmación de que llegaron los tréboles y exportación CSV.

import { html, raw, eur, eur0, num2, eurL, date, todayISO } from '../format.js';
import { fuelLabel } from '/shared/fuels.js';
import { capStatus, trebolStatus } from '/shared/treboles.js';
import { saveLog } from '../store.js';
import { payerOf, splitByPayer } from '/shared/modo.js';
import { realConsumption, roundConsumption } from '/shared/consumo.js';
import { activeVehicle, updateVehicle } from '/shared/vehiculos.js';
import { entrySaving, savingsSummary } from '/shared/ahorro.js';

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

// Consumo real del vehículo en uso, con un botón para usarlo en la ruta.
function consumptionCard(state) {
  const s = state.settings;
  const v = activeVehicle(s);
  if (!v) return '';
  const c = realConsumption(state.log, v.id);
  const name = `${v.icon} ${v.name}`;
  if (!c) {
    const withKm = state.log.filter((e) => e.vehicleId === v.id && Number(e.odometer) > 0).length;
    return html`<div class="consumo hint">
      <span class="label">⛽ Consumo real · ${name}</span>
      <p class="small">${withKm
        ? 'Ya tienes un llenado con km. En el próximo llenado apunta otra vez el cuentakilómetros y verás lo que gasta de verdad.'
        : 'Al registrar un repostaje, apunta los km del cuentakilómetros y marca «Lleno el depósito». Con dos llenados, la app calcula lo que gasta de verdad (y el plan de ruta lo usa).'}</p>
    </div>`;
  }
  const real = roundConsumption(c.l100);
  const differs = Math.abs(real - Number(s.consumption)) >= 0.2;
  const dec1 = (x) => x.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return html`<div class="consumo">
    <span class="label">⛽ Consumo real · ${name}</span>
    <div class="consumo-main"><strong>${dec1(real)}</strong><span>L/100 km</span><b class="consumo-eur">${eur(c.eur100)} / 100 km</b></div>
    <p class="small muted">En ${c.km.toLocaleString('es-ES')} km y ${num2(c.litres)} L (${c.segments} ${c.segments === 1 ? 'tramo' : 'tramos'} de lleno a lleno). Último: ${dec1(roundConsumption(c.last.l100))} L/100 km en ${c.last.km.toLocaleString('es-ES')} km.</p>
    ${differs ? html`<p class="small">En Ajustes tienes ${dec1(Number(s.consumption))} L/100 km.
      <button type="button" class="btn small primary" id="use-real" data-v="${v.id}" data-c="${real}">Usar ${dec1(real)} en el plan de ruta</button></p>` : ''}
  </div>`;
}

/** Tarjeta «Frente a la media»: lo que has pagado de menos este año eligiendo gasolinera. */
function savingsCard(log, today) {
  const y = savingsSummary(log.filter((e) => e.date.startsWith(today.slice(0, 4))));
  if (!y) return '';
  const m = savingsSummary(log.filter((e) => e.date.startsWith(today.slice(0, 7))));
  const good = y.total >= 0;
  return html`<div class="consumo ahorro ${good ? 'good' : 'bad'}">
    <span class="label">💰 Frente a la media de la zona · ${today.slice(0, 4)}</span>
    <div class="consumo-main"><strong>${eur(Math.abs(y.total))}</strong><span>${good ? 'menos' : 'más'} en el surtidor</span></div>
    <p class="small muted">${y.n} ${y.n === 1 ? 'repostaje' : 'repostajes'} · ${num2(y.litres)} L · ${(Math.abs(y.perLitre) * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} cts/L ${good ? 'por debajo' : 'por encima'} de la media${m ? ` · este mes ${m.total >= 0 ? '−' : '+'}${eur(Math.abs(m.total))}` : ''}. Los tréboles van aparte.</p>
  </div>`;
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
    ${raw(savingsCard(state.log, today))}
    ${raw(consumptionCard(state))}
    ${raw(monthlyChart(state.log, today))}`;
  document.getElementById('use-real')?.addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    updateVehicle(state.settings, b.dataset.v, { consumption: Number(b.dataset.c) });
    ctx.persist();
    ctx.recompute();
    ctx.toast(`Consumo actualizado: ${String(b.dataset.c).replace('.', ',')} L/100 km`);
    renderLog(ctx);
  });

  const list = document.getElementById('log-list');
  if (!state.log.length) {
    list.innerHTML = html`<li class="empty">Aún no has registrado repostajes. Abre una gasolinera y pulsa «Registrar repostaje», o usa «+ Añadir repostaje».</li>`;
    return;
  }
  list.innerHTML = html`${state.log.map((e) => {
    const st = trebolStatus(e, today);
    const sv = entrySaving(e);
    return html`
    <li class="log-item ${st?.kind === 'ask' ? 'ask' : ''}">
      <div>
        <strong>${e.name || 'Repostaje'}</strong>${payerOf(e) === 'company' ? html`<span class="log-payer">💼 Empresa</span>` : ''}
        <div class="small muted">${date(e.date)} · ${fuelLabel(e.fuel)} · ${num2(e.litres)} L a ${eurL(e.price)}${Number(e.odometer) > 0 ? ` · ${Number(e.odometer).toLocaleString('es-ES')} km${e.full === false ? '' : ' (lleno)'}` : ''}</div>
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
        ${sv != null && Math.abs(sv) >= 0.01 ? html`<div class="small vs-avg ${sv >= 0 ? 'good' : 'bad'}" title="Frente a la media de la zona (${eurL(e.areaAvg)})">${sv >= 0 ? '▼' : '▲'} ${eur(Math.abs(sv))} vs media</div>` : ''}
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
  const header = ['fecha', 'gasolinera', 'carburante', 'litros', 'precio_litro', 'importe', 'club_mapfre', 'porcentaje', 'importe_con_treboles', 'treboles', 'treboles_recibidos', 'paga', 'cuentakilometros', 'lleno', 'media_zona', 'ahorro_vs_media'];
  const rows = state.log.map((e) => [
    e.date, e.name, fuelLabel(e.fuel), dec(e.litres, 2), dec(e.price, 3), dec(e.amount, 2),
    e.mapfre ? 'sí' : 'no', dec(e.percent, 1), dec(e.eligibleAmount ?? (e.mapfre ? e.amount : 0), 2), dec(e.treboles, 2),
    e.confirmed === true ? 'sí' : e.confirmed === false ? 'no' : '',
    payerOf(e) === 'company' ? 'empresa' : 'yo',
    Number(e.odometer) > 0 ? Number(e.odometer) : '',
    Number(e.odometer) > 0 ? (e.full === false ? 'no' : 'sí') : '',
    e.areaAvg > 0 ? dec(e.areaAvg, 3) : '',
    entrySaving(e) != null ? dec(entrySaving(e), 2) : '',
  ]);
  const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `repostajes-${todayISO()}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
