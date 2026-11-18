// Evento de calendario (iCalendar, RFC 5545) para recordar los días del 6 %.

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const compact = (iso) => iso.replace(/-/g, '');

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Pliega las líneas largas a 75 octetos como pide el estándar. */
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * Evento de todo el día que se repite cada mes del día `fromDay` al `toDay`,
 * empezando en `startISO` (aaaa-mm-dd), con un aviso a las 9:00 del primer día.
 */
export function boostReminderIcs({ startISO, fromDay = 1, toDay = 5, percent = 6, stamp = new Date() }) {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Repostar con Treboles//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:dias-bonificados-treboles@repostar-con-treboles',
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${compact(startISO)}`,
    `DTEND;VALUE=DATE:${compact(addDays(startISO, toDay - fromDay + 1))}`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=${fromDay}`,
    `SUMMARY:${esc(`🍀 ${percent} % en tréboles al repostar (Club MAPFRE)`)}`,
    `DESCRIPTION:${esc(`Del día ${fromDay} al ${toDay} de cada mes Club MAPFRE devuelve el ${percent} % del repostaje en tréboles. Enseña el carnet al pagar. Comprueba que la promoción sigue vigente.`)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`Hoy empieza el ${percent} % en tréboles`)}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
