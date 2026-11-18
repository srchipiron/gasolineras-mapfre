// Carburantes que publica el Ministerio (Geoportal de Hidrocarburos).
// `field` es el nombre exacto del campo en la API REST. Si el Ministerio añade
// campos "Precio ..." nuevos, se aceptan igualmente con una clave generada.

export const FUELS = [
  { key: 'gasoleoA', label: 'Diésel', short: 'Diésel', field: 'Precio Gasoleo A' },
  { key: 'g95e5', label: 'Gasolina 95', short: 'G95', field: 'Precio Gasolina 95 E5' },
  { key: 'g98e5', label: 'Gasolina 98', short: 'G98', field: 'Precio Gasolina 98 E5' },
  { key: 'gasoleoP', label: 'Diésel Premium', short: 'Diésel+', field: 'Precio Gasoleo Premium' },
  { key: 'g95e5p', label: 'Gasolina 95 Premium', short: 'G95+', field: 'Precio Gasolina 95 E5 Premium' },
  { key: 'g95e10', label: 'Gasolina 95 E10', short: 'G95 E10', field: 'Precio Gasolina 95 E10' },
  { key: 'g98e10', label: 'Gasolina 98 E10', short: 'G98 E10', field: 'Precio Gasolina 98 E10' },
  { key: 'glp', label: 'GLP / Autogás', short: 'GLP', field: 'Precio Gases licuados del petróleo' },
  { key: 'gnc', label: 'Gas natural comprimido (GNC)', short: 'GNC', field: 'Precio Gas Natural Comprimido' },
  { key: 'gnl', label: 'Gas natural licuado (GNL)', short: 'GNL', field: 'Precio Gas Natural Licuado' },
  { key: 'gasoleoB', label: 'Gasóleo B (agrícola)', short: 'Gasóleo B', field: 'Precio Gasoleo B' },
  { key: 'biodiesel', label: 'Biodiésel', short: 'Biodiésel', field: 'Precio Biodiesel' },
  { key: 'bioetanol', label: 'Bioetanol', short: 'Bioetanol', field: 'Precio Bioetanol' },
  { key: 'dieselRenovable', label: 'Diésel renovable', short: 'Diésel R', field: 'Precio Diésel Renovable' },
  { key: 'gasolinaRenovable', label: 'Gasolina renovable', short: 'Gasolina R', field: 'Precio Gasolina Renovable' },
  { key: 'gasolina95E25', label: 'Gasolina 95 E25', short: 'E25', field: 'Precio Gasolina 95 E25' },
  { key: 'gasolina95E85', label: 'Gasolina 95 E85', short: 'E85', field: 'Precio Gasolina 95 E85' },
  { key: 'biogasNaturalComprimido', label: 'Biogás comprimido', short: 'BioGNC', field: 'Precio Biogas Natural Comprimido' },
  { key: 'biogasNaturalLicuado', label: 'Biogás licuado', short: 'BioGNL', field: 'Precio Biogas Natural Licuado' },
  { key: 'adblue', label: 'AdBlue', short: 'AdBlue', field: 'Precio Adblue' },
  { key: 'hidrogeno', label: 'Hidrógeno (€/kg)', short: 'H₂', field: 'Precio Hidrogeno' },
];

export const FUEL_BY_KEY = Object.fromEntries(FUELS.map((f) => [f.key, f]));
const FUEL_BY_FIELD = Object.fromEntries(FUELS.map((f) => [normField(f.field), f]));

function normField(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Clave interna para un campo "Precio XXX" de la API (o null si no es un precio). */
export function fuelKeyForField(field) {
  const n = normField(field);
  if (!n.startsWith('precio ')) return null;
  const known = FUEL_BY_FIELD[n];
  if (known) return known.key;
  return n
    .slice('precio '.length)
    .replace(/[^a-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
}

export function fuelLabel(key) {
  return FUEL_BY_KEY[key]?.label ?? key;
}
