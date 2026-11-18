// Ajustes → «Copia de seguridad»: guardar todos los datos de este dispositivo
// en un fichero y cargarlos en otro móvil, navegador o en la app instalada.

import { html, date } from '../format.js';
import { makeBackup, parseBackup, restoreBackup, backupSummary } from '/shared/backup.js';
import { KEYS } from '../store.js';

// La última búsqueda guardada no hace falta: se vuelve a descargar.
const BACKUP_KEYS = Object.values(KEYS).filter((k) => k !== KEYS.lastNearby);

export function backupSectionHtml() {
  return html`
    <h3>Copia de seguridad</h3>
    <p class="small muted">Para pasar a otro móvil, a otro navegador o a la app instalada tu lista oficial importada, favoritas, repostajes, carnet, vehículos y ajustes. En iPhone la app instalada en la pantalla de inicio no comparte datos con Safari: guarda la copia en uno y cárgala en el otro.</p>
    <div class="row wrap">
      <button type="button" class="btn" id="backup-save">💾 Guardar copia</button>
      <label class="btn file-btn">📂 Cargar copia<input type="file" id="backup-load" accept="application/json,.json" hidden></label>
    </div>`;
}

async function saveBackup(ctx) {
  const backup = makeBackup(localStorage, BACKUP_KEYS);
  const name = `gasolineras-copia-${backup.savedAt.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  // En el móvil, compartir permite mandártela por WhatsApp, correo o guardarla en Archivos.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Copia de Repostar con Tréboles' });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  ctx.toast(`Copia guardada: ${backupSummary(backup.data, KEYS)}`, 5000);
}

async function loadBackup(ctx, file) {
  let backup;
  try {
    backup = parseBackup(await file.text(), BACKUP_KEYS);
  } catch (err) {
    ctx.toast(err.message, 5000);
    return;
  }
  const when = backup.savedAt ? ` del ${date(backup.savedAt)}` : '';
  if (!confirm(`¿Cargar la copia${when} (${backupSummary(backup.data, KEYS)})? Sustituye los datos de este dispositivo.`)) return;
  try {
    restoreBackup(localStorage, backup);
  } catch {
    ctx.toast('No se pudo guardar la copia en este dispositivo (¿sin espacio?)', 5000);
    return;
  }
  location.reload();
}

export function bindBackup(root, ctx) {
  root.querySelector('#backup-save')?.addEventListener('click', () => saveBackup(ctx));
  root.querySelector('#backup-load')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) loadBackup(ctx, f);
    e.target.value = '';
  });
}
