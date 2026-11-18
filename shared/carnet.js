// Carnet de socio de Club MAPFRE: número normalizado y formato del código de
// barras. El número solo se guarda en el dispositivo del usuario.

/** Quita espacios, guiones y puntos; deja letras y números en mayúsculas. */
export function normalizeCardNumber(text) {
  return String(text ?? '').toUpperCase().replace(/[\s.\-_/]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 40);
}

/** ¿Es un EAN-13 válido (13 cifras con dígito de control correcto)? */
export function isEan13(code) {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((s, d, i) => s + d * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

/**
 * Formato del código de barras: EAN-13 si el número lo es (como muchas
 * tarjetas de fidelización) y, si no, Code 128, que admite letras y números.
 */
export function barcodeFormat(code, preferred = 'auto') {
  if (preferred === 'EAN13' && isEan13(code)) return 'EAN13';
  if (preferred === 'CODE128') return 'CODE128';
  return isEan13(code) ? 'EAN13' : 'CODE128';
}

/** Número agrupado de 4 en 4 para leerlo en voz alta en caja. */
export function groupNumber(code) {
  return code.replace(/(.{4})(?=.)/g, '$1 ');
}
