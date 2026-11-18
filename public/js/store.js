// Persistencia local (en el navegador): ajustes, favoritas y repostajes.

import { cloneProgram, emptyOfficial, migrateProgram } from '/shared/treboles.js';
import { ensureVehicles } from '/shared/vehiculos.js';

export const KEYS = {
  settings: 'gm.settings.v1',
  favorites: 'gm.favorites.v1',
  log: 'gm.log.v1',
  official: 'gm.official.v1',
  notes: 'gm.notes.v1',
  card: 'gm.card.v1',
};

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
  onlyMapfre: true, // por defecto solo se ven las adheridas de la lista oficial
  officialFilter: 'all', // 'all' | 'colaboradora' | 'repsol', como el mapa oficial
  openNow: false,
  hideRestricted: true,
  litres: 40,
  consumption: 6.5,
  corridorKm: 2,
  routeSort: 'effective',
  program: cloneProgram(),
  overrides: {}, // { idEstacion: 'in' | 'out' }
  markMode: false, // botón rápido para marcar adheridas en la lista
  settingsVersion: 2,
  vehicles: [], // perfiles de vehículo (ver shared/vehiculos.js)
  vehicleId: null,
  lastLocation: null, // { lat, lon, label }
};

export function loadSettings() {
  const saved = read(KEYS.settings, {});
  const s = ensureVehicles({
    ...structuredClone(DEFAULT_SETTINGS),
    ...saved,
    program: migrateProgram(saved.program),
    overrides: saved.overrides ?? {},
  });
  // Versión 2: solo se muestran las adheridas de la lista oficial.
  if ((saved.settingsVersion ?? 1) < 2) {
    s.onlyMapfre = true;
    s.settingsVersion = 2;
  }
  return s;
}

export const saveSettings = (s) => write(KEYS.settings, s);

export function resetSettings(current) {
  const s = structuredClone(DEFAULT_SETTINGS);
  s.lastLocation = current?.lastLocation ?? null;
  // Se conservan tus vehículos.
  s.vehicles = current?.vehicles ?? [];
  s.vehicleId = current?.vehicleId ?? null;
  ensureVehicles(s);
  const v = s.vehicles.find((x) => x.id === s.vehicleId);
  if (v) Object.assign(s, { fuel: v.fuel, litres: v.litres, consumption: v.consumption });
  saveSettings(s);
  return s;
}

// ---- Lista oficial importada en este dispositivo ----
export const loadLocalOfficial = () => read(KEYS.official, emptyOfficial());
export const saveLocalOfficial = (o) => write(KEYS.official, o);

// ---- Tu experiencia en cada gasolinera ----
// { idEstacion: { verdict: 'ok' | 'ko' | null, note: '', date: 'aaaa-mm-dd' } }
export const loadNotes = () => read(KEYS.notes, {});
export const saveNotes = (n) => write(KEYS.notes, n);

// ---- Carnet de socio (solo en este dispositivo) ----
export const loadCard = () => read(KEYS.card, null);
export function saveCard(card) {
  if (!card) {
    try { localStorage.removeItem(KEYS.card); } catch { /* nada */ }
    return true;
  }
  return write(KEYS.card, card);
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
