// «Instalar la app»: botón en Android/Chrome (beforeinstallprompt) e
// instrucciones en iPhone, donde Safari no permite instalar desde un botón.

import { html } from './format.js';

let deferred = null;
const listeners = new Set();

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canPrompt = () => !!deferred;

export function onInstallChange(fn) {
  listeners.add(fn);
}

const notify = () => listeners.forEach((fn) => fn());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  notify();
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

/** Muestra el diálogo de instalación del navegador. Devuelve true si se instaló. */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  e.prompt();
  const choice = await e.userChoice.catch(() => ({ outcome: 'dismissed' }));
  notify();
  return choice.outcome === 'accepted';
}

const IOS_STEPS = 'En Safari, pulsa Compartir (el cuadrado con la flecha ⬆️) y luego «Añadir a pantalla de inicio».';
const OTHER_STEPS = 'En el menú ⋮ del navegador, elige «Instalar aplicación» o «Añadir a pantalla de inicio». En iPhone: Safari → Compartir ⬆️ → «Añadir a pantalla de inicio».';

/** Sección de Ajustes. */
export function installSectionHtml() {
  let body;
  if (isStandalone()) body = html`<p class="small">✓ Estás usando la app instalada.</p>`;
  else if (canPrompt()) body = html`<button type="button" class="btn primary" id="install-app">📲 Instalar app</button>`;
  else body = html`<p class="small">${isIos() ? IOS_STEPS : OTHER_STEPS}</p>`;
  return html`
    <h3>Instalar en el móvil</h3>
    <p class="small muted">Instalada se abre a pantalla completa como una app, tiene accesos directos al mantener pulsado el icono (carnet, cerca, repostaje, ruta) y funciona sin conexión con los últimos precios vistos.</p>
    ${body}`;
}

/**
 * Aviso para instalar (una sola vez): con botón en Android y con
 * instrucciones en iPhone.
 */
export function setupInstallBanner({ el, dismissed, onDismiss, toast }) {
  const render = () => {
    if (dismissed() || isStandalone() || (!canPrompt() && !isIos())) {
      el.hidden = true;
      return;
    }
    el.innerHTML = canPrompt()
      ? html`<span>📲 Instala la app en tu móvil: se abre al momento y funciona sin conexión.</span>
          <button type="button" class="btn small primary" data-install>Instalar</button>
          <button type="button" class="btn small icon" data-dismiss aria-label="No mostrar más">✕</button>`
      : html`<span>📲 ¿La quieres como app en tu iPhone? ${IOS_STEPS}</span>
          <button type="button" class="btn small icon" data-dismiss aria-label="No mostrar más">✕</button>`;
    el.hidden = false;
    el.querySelector('[data-install]')?.addEventListener('click', async () => {
      if (await promptInstall()) toast('App instalada ✓');
    });
    el.querySelector('[data-dismiss]').addEventListener('click', () => {
      onDismiss();
      el.hidden = true;
    });
  };
  onInstallChange(render);
  render();
}
