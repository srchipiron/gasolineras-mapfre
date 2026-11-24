// Identidad visual de cada marca de gasolinera: con qué clase CSS se pinta
// (colores de la marca, definidos en app.css como .b-<clave>) y el emblema
// corto que va en su cuadradito. Los rótulos del Ministerio vienen en
// mayúsculas y a menudo con apellido («BP GETAFE - M406», «REPSOL ALHAMBRA»).

const BRANDS = [
  // [clave, emblema, palabras con las que empieza el rótulo]
  ['repsol', 'R', ['REPSOL']],
  ['campsa', 'C', ['CAMPSA']],
  ['petronor', 'P', ['PETRONOR']],
  ['moeve', 'm', ['MOEVE']],
  ['cepsa', 'C', ['CEPSA']],
  ['galp', 'G', ['GALP']],
  ['bp', 'bp', ['BP']],
  ['shell', 'S', ['SHELL']],
  ['ballenoil', 'B', ['BALLENOIL']],
  ['plenergy', 'P', ['PLENERGY', 'PLENOIL']],
  ['petroprix', 'PX', ['PETROPRIX']],
  ['carrefour', 'C', ['CARREFOUR']],
  ['alcampo', 'A', ['ALCAMPO']],
  ['supeco', 'S', ['SUPECO']],
  ['eroski', 'E', ['EROSKI']],
  ['leclerc', 'E', ['E.LECLERC', 'E. LECLERC', 'LECLERC']],
  ['eni', 'eni', ['ENI', 'ENILIVE', 'AGIP']],
  ['avia', 'A', ['AVIA']],
  ['q8', 'Q8', ['Q8']],
  ['esso', 'E', ['ESSO']],
  ['disa', 'D', ['DISA']],
  ['star', '★', ['STAR PETROLEUM', 'STAR']],
  ['bonarea', 'b', ['BONAREA', 'BON AREA']],
  ['tamoil', 'T', ['TAMOIL']],
  ['naturgy', 'N', ['NATURGY']],
  ['meroil', 'M', ['MEROIL']],
  ['petrocat', 'P', ['PETROCAT']],
  ['valcarce', 'V', ['VALCARCE']],
  ['costco', 'C', ['COSTCO']],
  ['easygas', 'E', ['EASYGAS']],
];

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim();

// Palabra suelta al principio: «BP GETAFE» sí, «BPX» no; «GALP&GO» sí.
const startsWithWord = (name, word) => name === word
  || (name.startsWith(word) && !/[A-Z0-9]/.test(name[word.length]));

/** Iniciales para las marcas sin colores propios: «LOW COST REPOST» → «LC». */
function initials(name) {
  const words = name.replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter((w) => w && !/^(DE|LA|EL|LOS|LAS|Y)$/.test(w));
  if (!words.length) return '⛽';
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[1][0];
}

// Logotipos oficiales (public/img/marcas, sacados de Wikimedia). «sq» cabe en
// un cuadradito; «wide» es un rótulo alargado que solo luce en la ficha.
export const LOGOS = {
  repsol: ['repsol.svg', 'sq'],
  bp: ['bp.svg', 'sq'],
  shell: ['shell.svg', 'sq'],
  galp: ['galp.svg', 'sq'],
  avia: ['avia.svg', 'sq'],
  esso: ['esso.svg', 'sq'],
  q8: ['q8.svg', 'sq'],
  moeve: ['moeve.svg', 'wide'],
  cepsa: ['cepsa.svg', 'wide'],
  leclerc: ['leclerc.svg', 'wide'],
  costco: ['costco.svg', 'wide'],
  eni: ['eni.svg', 'wide'],
  plenergy: ['plenergy.png', 'wide'],
  petroprix: ['petroprix.png', 'wide'],
  disa: ['disa.svg', 'sq'],
  eroski: ['eroski.svg', 'wide'],
};

/** { key, mono, logo, logoShape } de una marca. key = 'otra' si no tiene colores propios. */
const WORDS = BRANDS.map(([key, mono, words]) => [key, mono, words.map(norm)]);
const memo = new Map(); // se llama por cada gasolinera en cada repintado

export function brandStyle(brand) {
  const raw = String(brand ?? '');
  const hit = memo.get(raw);
  if (hit) return hit;
  const name = norm(raw);
  let out = { key: 'otra', mono: initials(name), logo: null, logoShape: null };
  for (const [key, mono, words] of WORDS) {
    if (words.some((w) => startsWithWord(name, w))) {
      const l = LOGOS[key];
      out = { key, mono, logo: l ? `/img/marcas/${l[0]}` : null, logoShape: l?.[1] ?? null };
      break;
    }
  }
  if (memo.size > 2000) memo.clear();
  memo.set(raw, Object.freeze(out));
  return out;
}

/** Primera palabra del rótulo, para el nombre en grande de fondo («BP GETAFE» → «BP»). */
export const brandWord = (brand) => String(brand ?? '').trim().split(/[\s\-–·]+/)[0];

/**
 * Identificador de la marca para ocultarla: la clave si es conocida
 * («REPSOL ALHAMBRA» → «repsol») o la primera palabra («RASPAOIL ALMERIA» → «RASPAOIL»).
 */
export function brandId(brand) {
  const { key } = brandStyle(brand);
  return key !== 'otra' ? key : norm(brandWord(brand));
}

export const BRAND_KEYS = BRANDS.map(([k]) => k);
