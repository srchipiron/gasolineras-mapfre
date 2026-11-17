// Persistencia local (en el navegador): ajustes, favoritas y repostajes.

import { DEFAULT_PROGRAM, cloneProgram } from '/shared/treboles.js';

const KEYS = { settings: 'gm.settings.v1', favorites: 'gm.favorites.v1', log: 'gm.log.v1' };

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_SETTINGS = {
  fuel: 'gasoleoA',
  radiusKm: 10,
  sort: 'effective',
  onlyMapfre: false,
  openNow: false,
  hideRestricted: true,
  litres: 40,
  consumption: 6.5,
  corridorKm: 2,
  routeSort: 'effective',
  program: cloneProgram(),
  overrides: {}, // { idEstacion: 'in' | 'out' }
  lastLocation: null, // { lat, lon, label }
};

/** Mezcla las reglas guardadas con las de fábrica (por si llegan reglas nuevas). */
function mergeProgram(saved) {
  const base = cloneProgram(DEFAULT_PROGRAM);
  if (!saved || typeof saved !== 'object') return base;
  const rules = base.rules.map((r) => ({ ...r, ...(saved.rules ?? []).find((s) => s.id === r.id) }));
  for (const s of saved.rules ?? []) if (!rules.some((r) => r.id === s.id)) rules.push(s);
  return {
    ...base,
    trebolValue: Number.isFinite(saved.trebolValue) ? saved.trebolValue : base.trebolValue,
    rules,
    manual: { ...base.manual, ...(saved.manual ?? {}) },
  };
}

export function loadSettings() {
  const saved = read(KEYS.settings, {});
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    ...saved,
    program: mergeProgram(saved.program),
    overrides: saved.overrides ?? {},
  };
}

export const saveSettings = (s) => write(KEYS.settings, s);

export function resetSettings(current) {
  const s = structuredClone(DEFAULT_SETTINGS);
  s.lastLocation = current?.lastLocation ?? null;
  saveSettings(s);
  return s;
}

// ---- Favoritas ----
export const loadFavorites = () => read(KEYS.favorites, []);
export const saveFavorites = (f) => write(KEYS.favorites, f);

export function isFavorite(favs, id) {
  return favs.some((f) => f.id === id);
}

export function toggleFavorite(favs, st) {
  const next = isFavorite(favs, st.id)
    ? favs.filter((f) => f.id !== st.id)
    : [...favs, { id: st.id, brand: st.brand, address: st.address, locality: st.locality, target: null }];
  saveFavorites(next);
  return next;
}

// ---- Repostajes ----
export const loadLog = () => read(KEYS.log, []);
export const saveLog = (l) => write(KEYS.log, l);

export function newId() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}
