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

/** { key, mono } de una marca. key = 'otra' si no tiene colores propios. */
export function brandStyle(brand) {
  const name = norm(brand);
  for (const [key, mono, words] of BRANDS) {
    if (words.some((w) => startsWithWord(name, norm(w)))) return { key, mono };
  }
  return { key: 'otra', mono: initials(name) };
}

export const BRAND_KEYS = BRANDS.map(([k]) => k);
