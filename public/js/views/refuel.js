// Formulario para registrar un repostaje y calcular los tréboles ganados.

import { html, todayISO, num2, eur } from '../format.js';
import { FUELS } from '/shared/fuels.js';
import { findRule, percentFor, treblesFor, fuelEligible, cappedAmount } from '/shared/treboles.js';
import { saveLog, newId } from '../store.js';
import { isCompany } from '/shared/modo.js';
import { lastOdometer } from '/shared/consumo.js';

export function openRefuel(ctx, station = null) {
  const { state } = ctx;
  const dlg = document.getElementById('refuel');
  const s = state.settings;
  const rule = station ? findRule(station, s.program, s.overrides, state.official) : null;
  const fuel = station && station.prices[s.fuel] == null
    ? Object.keys(station.prices)[0] ?? s.fuel
    : s.fuel;
  const price = station?.prices[fuel] ?? '';
  const company = isCompany(s);
  const vehicleId = s.vehicleId ?? null;
  const lastKm = vehicleId ? lastOdometer(state.log, vehicleId) : null;
  const fuels = FUELS.filter((f) => !station || station.prices[f.key] != null || f.key === fuel);

  dlg.innerHTML = html`
  <form method="dialog" class="sheet-head">
    <h2>Registrar repostaje</h2>
    <button class="btn icon" value="cancel" aria-label="Cerrar">✕</button>
  </form>
  <form class="sheet-body stack" id="refuel-form">
    <label class="field"><span>Gasolinera</span>
      <input name="name" required value="${station ? `${station.brand} · ${station.address}` : ''}" placeholder="Nombre de la gasolinera">
    </label>
    <div class="row">
      <label class="field"><span>Fecha</span><input type="date" name="date" required value="${todayISO()}"></label>
      <label class="field"><span>Carburante</span>
        <select name="fuel">${fuels.map((f) => html`<option value="${f.key}" ${f.key === fuel ? 'selected' : ''}>${f.label}</option>`)}</select>
      </label>
    </div>
    <div class="row">
      <label class="field"><span>Litros</span><input type="number" name="litres" step="0.01" min="0" inputmode="decimal" value="${s.litres}" required></label>
      <label class="field"><span>Precio €/L</span><input type="number" name="price" step="0.001" min="0" inputmode="decimal" value="${price}" required></label>
      <label class="field"><span>Importe €</span><input type="number" name="amount" step="0.01" min="0" inputmode="decimal"></label>
    </div>
    <div class="row odo-row">
      <label class="field"><span>Cuentakilómetros (km)</span><input type="number" name="odometer" step="1" min="0" inputmode="numeric" placeholder="${lastKm ? `Último: ${lastKm.toLocaleString('es-ES')}` : 'Opcional'}"></label>
      <label class="chip"><input type="checkbox" name="full" checked> Lleno el depósito</label>
    </div>
    <p class="small muted odo-note" id="odo-note">Apunta los km al llenar y la app calcula lo que gasta de verdad tu vehículo.</p>
    <div class="payer-row" role="radiogroup" aria-label="¿Quién paga?">
      <label class="chip"><input type="radio" name="payer" value="personal" ${company ? '' : 'checked'}> 🚗 Pago yo</label>
      <label class="chip"><input type="radio" name="payer" value="company" ${company ? 'checked' : ''}> 💼 Paga la empresa</label>
    </div>
    <div class="row">
      <label class="chip"><input type="checkbox" name="mapfre" ${rule ? 'checked' : ''}> Club MAPFRE</label>
      <label class="field"><span>% en tréboles</span><input type="number" name="percent" step="0.5" min="0" max="100" inputmode="decimal"></label>
    </div>
    <p class="calc" id="refuel-calc"></p>
    <button class="btn primary" type="submit">Guardar</button>
  </form>`;

  const f = dlg.querySelector('#refuel-form');
  const el = (n) => f.elements.namedItem(n);
  const ruleFor = () => rule ?? s.program.manual;
  const setPercent = () => {
    const d = new Date(`${el('date').value}T12:00:00`);
    const ok = el('mapfre').checked && fuelEligible(s.program, el('fuel').value);
    el('percent').value = ok ? percentFor(ruleFor(), d) : 0;
  };
  // Importe que da tréboles: tope de 100 € al día y 300 € a la semana.
  const eligible = () => (rule?.noCap
    ? Number(el('amount').value) || 0
    : cappedAmount(Number(el('amount').value) || 0, el('date').value, state.log, s.program));
  const calc = () => {
    const amount = Number(el('amount').value) || 0;
    const base = eligible();
    const t = treblesFor(base, Number(el('percent').value) || 0);
    const out = dlg.querySelector('#refuel-calc');
    if (!el('mapfre').checked) out.textContent = 'Sin tréboles (no es Club MAPFRE).';
    else if (!fuelEligible(s.program, el('fuel').value)) out.textContent = 'Este carburante no da tréboles (GLP y GNC excluidos).';
    else {
      out.textContent = `Ganarás ${num2(t)} tréboles (${eur(t * (s.program.trebolValue ?? 1))} de descuento en tu seguro).` +
        (base < amount ? ` Solo cuentan ${eur(base)} por el tope de 100 € al día y 300 € a la semana.` : '');
    }
  };
  const fromLitres = () => {
    el('amount').value = ((Number(el('litres').value) || 0) * (Number(el('price').value) || 0)).toFixed(2);
    calc();
  };
  el('litres').addEventListener('input', fromLitres);
  el('price').addEventListener('input', fromLitres);
  el('amount').addEventListener('input', () => {
    const p = Number(el('price').value);
    if (p > 0) el('litres').value = ((Number(el('amount').value) || 0) / p).toFixed(2);
    calc();
  });
  el('fuel').addEventListener('change', () => {
    const v = station?.prices[el('fuel').value];
    if (v != null) el('price').value = v;
    setPercent();
    fromLitres();
  });
  el('mapfre').addEventListener('change', () => { setPercent(); calc(); });
  el('date').addEventListener('change', () => { setPercent(); calc(); });
  el('percent').addEventListener('input', calc);
  el('odometer').addEventListener('input', () => {
    const v = Number(el('odometer').value);
    const note = dlg.querySelector('#odo-note');
    if (!v || !lastKm) return;
    note.textContent = v > lastKm
      ? `${(v - lastKm).toLocaleString('es-ES')} km desde el último repostaje apuntado.`
      : `Ojo: es menos que la última vez (${lastKm.toLocaleString('es-ES')} km).`;
  });
  setPercent();
  fromLitres();

  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const amount = Number(el('amount').value) || 0;
    const percent = Number(el('percent').value) || 0;
    const eligibleAmount = el('mapfre').checked ? eligible() : 0;
    const entry = {
      id: newId(),
      date: el('date').value,
      stationId: station?.id ?? null,
      name: el('name').value.trim(),
      fuel: el('fuel').value,
      litres: Number(el('litres').value) || 0,
      price: Number(el('price').value) || 0,
      amount,
      mapfre: el('mapfre').checked,
      percent,
      eligibleAmount,
      treboles: el('mapfre').checked ? treblesFor(eligibleAmount, percent) : 0,
      payer: f.querySelector('input[name=payer]:checked')?.value === 'company' ? 'company' : 'personal',
      vehicleId,
      odometer: Number(el('odometer').value) > 0 ? Math.round(Number(el('odometer').value)) : null,
      full: el('full').checked,
    };
    state.log = [entry, ...state.log].sort((a, b) => b.date.localeCompare(a.date));
    saveLog(state.log);
    dlg.close();
    const who = entry.payer === 'company' ? ' (paga la empresa)' : '';
    ctx.toast(entry.mapfre ? `Repostaje guardado${who}: +${num2(entry.treboles)} tréboles 🍀 para ti` : `Repostaje guardado${who}`);
    ctx.refreshTab('log');
    ctx.recompute(); // el tope diario/semanal cambia los precios con tréboles
    ctx.afterRefuel?.(entry); // plan de repostaje de la ruta desde este llenado
  });

  if (!dlg.open) dlg.showModal();
}
