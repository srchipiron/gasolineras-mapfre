// Ahorro de cada repostaje frente a la media de la zona: al registrarlo se
// guarda el precio medio de las gasolineras que estabas viendo (areaAvg) y
// aquí se calcula cuánto pagaste de menos (o de más) en el surtidor.

const round2 = (n) => Math.round(n * 100) / 100;

/** € pagados de menos (positivo) o de más (negativo) frente a la media; null si no se sabe. */
export function entrySaving(e) {
  const avg = Number(e?.areaAvg), price = Number(e?.price), litres = Number(e?.litres);
  if (!(avg > 0) || !(price > 0) || !(litres > 0)) return null;
  return round2((avg - price) * litres);
}

/** Suma del ahorro de los repostajes que lo tienen: { total, n, litres, perLitre } o null. */
export function savingsSummary(entries) {
  let total = 0, n = 0, litres = 0;
  for (const e of entries ?? []) {
    const s = entrySaving(e);
    if (s == null) continue;
    total += s;
    litres += Number(e.litres);
    n++;
  }
  if (!n) return null;
  return { total: round2(total), n, litres: round2(litres), perLitre: litres ? total / litres : 0 };
}
