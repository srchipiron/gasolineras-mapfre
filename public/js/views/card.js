// «Mi carnet»: muestra el carnet de socio de Club MAPFRE a pantalla completa
// con QR y código de barras para enseñarlo en caja. El número se guarda solo
// en este dispositivo (localStorage) y nunca se envía al servidor.

import { html, raw } from '../format.js';
import { normalizeCardNumber, barcodeFormat, groupNumber } from '/shared/carnet.js';
import { loadCard, saveCard } from '../store.js';

let wakeLock = null;

async function keepScreenOn() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* el navegador no lo permite: no pasa nada */
  }
}

function releaseScreen() {
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}

function qrSvg(text) {
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true, alt: 'QR del carnet' });
  } catch {
    return '';
  }
}

function drawBarcode(svg, number, preferred) {
  const opts = { displayValue: false, margin: 12, height: 100, width: 2.6, background: '#ffffff', lineColor: '#000000' };
  try {
    window.JsBarcode(svg, number, { ...opts, format: barcodeFormat(number, preferred) });
  } catch {
    try {
      window.JsBarcode(svg, number, { ...opts, format: 'CODE128' });
    } catch {
      svg.remove();
    }
  }
}

export function openCard(ctx) {
  const card = loadCard();
  if (!card?.number) {
    ctx.toast('Guarda primero tu número de socio en Ajustes → Mi carnet', 4500);
    ctx.selectTab('settings');
    setTimeout(() => document.getElementById('card-number')?.focus(), 200);
    return;
  }
  const dlg = document.getElementById('card');
  dlg.innerHTML = html`
    <div class="card-sheet">
      <div class="card-head">
        <b>🍀 Club MAPFRE · Carnet de socio</b>
        <button type="button" class="btn icon" data-close aria-label="Cerrar">✕</button>
      </div>
      ${card.name ? html`<p class="card-name">${card.name}</p>` : ''}
      <div class="card-qr">${raw(qrSvg(card.number))}</div>
      <svg class="card-barcode" role="img" aria-label="Código de barras del carnet"></svg>
      <p class="card-number">${groupNumber(card.number)}</p>
      <p class="card-help">Enséñalo al pagar en caja, antes de cobrar. Si el lector no lo acepta, dicta el número o usa el carnet de la app oficial.</p>
    </div>`;
  drawBarcode(dlg.querySelector('.card-barcode'), card.number, card.barcode);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', releaseScreen, { once: true });
  if (!dlg.open) dlg.showModal();
  keepScreenOn();
}

/** Sección de Ajustes para guardar el número del carnet. */
export function cardSettingsHtml() {
  const card = loadCard() ?? {};
  return html`
    <h3>Mi carnet Club MAPFRE</h3>
    <p class="small muted">Guarda tu número de socio para enseñarlo en caja con QR y código de barras (botón «🪪 Mi carnet» de arriba). Se guarda solo en este dispositivo.</p>
    <div class="row">
      <label class="field"><span>Número de socio</span><input id="card-number" inputmode="text" autocomplete="off" maxlength="48" value="${card.number ?? ''}" placeholder="El número de tu carnet"></label>
    </div>
    <div class="row">
      <label class="field"><span>Nombre (opcional)</span><input id="card-name" maxlength="60" value="${card.name ?? ''}"></label>
      <label class="field"><span>Código de barras</span>
        <select id="card-barcode">
          <option value="auto" ${!card.barcode || card.barcode === 'auto' ? 'selected' : ''}>Automático</option>
          <option value="CODE128" ${card.barcode === 'CODE128' ? 'selected' : ''}>Code 128</option>
          <option value="EAN13" ${card.barcode === 'EAN13' ? 'selected' : ''}>EAN-13</option>
        </select>
      </label>
    </div>
    <div class="row wrap">
      <button type="button" class="btn primary" id="card-save">Guardar carnet</button>
      ${card.number ? html`<button type="button" class="btn" id="card-show">🪪 Ver carnet</button><button type="button" class="btn danger" id="card-delete">Borrar</button>` : ''}
    </div>`;
}

export function bindCardSettings(root, ctx, rerender) {
  root.querySelector('#card-save')?.addEventListener('click', () => {
    const number = normalizeCardNumber(root.querySelector('#card-number').value);
    if (number.length < 4) {
      ctx.toast('Escribe el número de tu carnet (al menos 4 caracteres)');
      return;
    }
    saveCard({
      number,
      name: root.querySelector('#card-name').value.trim().slice(0, 60),
      barcode: root.querySelector('#card-barcode').value,
    });
    ctx.toast('Carnet guardado 🪪');
    rerender();
  });
  root.querySelector('#card-show')?.addEventListener('click', () => openCard(ctx));
  root.querySelector('#card-delete')?.addEventListener('click', () => {
    if (!confirm('¿Borrar el carnet guardado en este dispositivo?')) return;
    saveCard(null);
    rerender();
  });
}
