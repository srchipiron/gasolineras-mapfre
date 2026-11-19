// Listas capturadas del mapa oficial con el marcador «Enviar a Tréboles»
// (shared/capturar.js). El marcador sube aquí lo que el mapa le ha enseñado y
// recibe un código; la app, al abrirse con ese código, la recoge una sola vez.
// Solo en memoria y durante unos minutos: no se guarda nada en disco.

import { randomBytes } from 'node:crypto';

export function createCaptureStore({ ttlMs = 30 * 60 * 1000, max = 10, now = () => Date.now() } = {}) {
  const items = new Map(); // id -> { entries, at }
  const prune = () => {
    for (const [id, it] of items) if (now() - it.at > ttlMs) items.delete(id);
    while (items.size > max) items.delete(items.keys().next().value); // las más viejas
  };
  return {
    put(entries) {
      prune();
      const id = randomBytes(12).toString('base64url');
      items.set(id, { entries, at: now() });
      prune();
      return id;
    },
    /** La lista del código (una sola vez), o null si no existe o caducó. */
    take(id) {
      prune();
      const it = items.get(id);
      items.delete(id);
      return it ? it.entries : null;
    },
    get size() {
      prune();
      return items.size;
    },
  };
}
