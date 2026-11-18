// Interpreta el campo "Horario" del Ministerio, p. ej.
//   "L-D: 24H"
//   "L-V: 06:00-22:00; S: 07:00-15:00"
//   "L-V: 07:00-14:30 y 16:00-21:00; S-D: 09:00-14:00"
//   "L-D: 22:00-06:00"   (cruza la medianoche)

const DAY_LETTERS = { L: 0, M: 1, X: 2, J: 3, V: 4, S: 5, D: 6 };
export const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function parseDays(spec) {
  const days = new Set();
  const s = spec.toUpperCase().replace(/\s+/g, '');
  if (!s) return days;
  for (const part of s.split(/[,y]/i)) {
    if (!part) continue;
    const m = part.match(/^([LMXJVSD])(?:-([LMXJVSD]))?$/);
    if (!m) return null;
    const a = DAY_LETTERS[m[1]];
    const b = m[2] !== undefined ? DAY_LETTERS[m[2]] : a;
    for (let i = a; ; i = (i + 1) % 7) {
      days.add(i);
      if (i === b) break;
    }
  }
  return days;
}

function toMin(hh, mm) {
  return Number(hh) * 60 + Number(mm);
}

function parseIntervals(spec) {
  const s = spec.trim().toUpperCase();
  if (/^24\s*H/.test(s)) return [[0, 1440]];
  const out = [];
  const re = /(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})/g;
  let m;
  while ((m = re.exec(s))) {
    const start = toMin(m[1], m[2]);
    let end = toMin(m[3], m[4]);
    if (end === start) end = start + 1440; // 00:00-00:00 → 24 h
    else if (end < start) end += 1440; // cruza la medianoche
    out.push([start, end]);
  }
  return out.length ? out : null;
}

/**
 * Devuelve un array de 7 posiciones (0 = lunes) con los intervalos de apertura
 * en minutos desde las 00:00. Un fin > 1440 significa que cierra al día
 * siguiente. Devuelve null si el texto no se puede interpretar.
 */
export function parseSchedule(text) {
  if (!text || typeof text !== 'string') return null;
  const week = [[], [], [], [], [], [], []];
  let any = false;
  // Unas 500 estaciones publican solo "L: 06:00-22:00" o "L: 24H". No se sabe
  // si se refieren solo al lunes o a toda la semana, así que es desconocido.
  const daySpecs = text.split(';').map((c) => c.trim()).filter(Boolean).map((c) => c.split(':')[0].trim().toUpperCase());
  if (daySpecs.length && daySpecs.every((d) => d === 'L')) return null;
  for (const chunk of text.split(';')) {
    const c = chunk.trim();
    if (!c) continue;
    const colon = c.indexOf(':');
    let daySpec, timeSpec;
    // "L-D: 24H" -> el primer ":" separa días y horas, salvo que no haya días
    if (colon > -1 && /^[LMXJVSD\s,\-y]+$/i.test(c.slice(0, colon))) {
      daySpec = c.slice(0, colon);
      timeSpec = c.slice(colon + 1);
    } else {
      daySpec = 'L-D';
      timeSpec = c;
    }
    const days = parseDays(daySpec);
    const intervals = parseIntervals(timeSpec);
    if (!days || !days.size || !intervals) continue;
    for (const d of days) week[d].push(...intervals);
    any = true;
  }
  if (!any) return null;
  for (const d of week) d.sort((a, b) => a[0] - b[0]);
  return week;
}

/** Día de la semana con 0 = lunes. */
export function weekday(date) {
  return (date.getDay() + 6) % 7;
}

/** ¿Está abierta en ese instante? true / false / null (horario desconocido). */
export function isOpenAt(schedule, date = new Date()) {
  const week = typeof schedule === 'string' ? parseSchedule(schedule) : schedule;
  if (!week) return null;
  const wd = weekday(date);
  const m = date.getHours() * 60 + date.getMinutes();
  for (const [s, e] of week[wd]) if (m >= s && m < e) return true;
  const prev = week[(wd + 6) % 7];
  for (const [s, e] of prev) if (e > 1440 && m + 1440 >= s && m + 1440 < e) return true;
  return false;
}

export function is24h(schedule) {
  const week = typeof schedule === 'string' ? parseSchedule(schedule) : schedule;
  return !!week && week.every((d) => d.some(([s, e]) => s <= 0 && e >= 1440));
}

const hhmm = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Estado legible: { open, label } p. ej. "Abierta · cierra a las 22:00". */
export function openStatus(text, date = new Date()) {
  const week = parseSchedule(text);
  if (!week) return { open: null, label: 'Horario no disponible' };
  if (is24h(week)) return { open: true, label: 'Abierta 24 h' };
  const open = isOpenAt(week, date);
  const wd = weekday(date);
  const m = date.getHours() * 60 + date.getMinutes();
  if (open) {
    let closes = null;
    for (const [s, e] of week[wd]) if (m >= s && m < e) closes = e;
    if (closes === null) {
      for (const [s, e] of week[(wd + 6) % 7]) if (e > 1440 && m + 1440 >= s && m + 1440 < e) closes = e - 1440;
    }
    return { open: true, label: closes !== null ? `Abierta · cierra a las ${hhmm(closes)}` : 'Abierta' };
  }
  for (let i = 0; i < 7; i++) {
    const d = (wd + i) % 7;
    for (const [s] of week[d]) {
      if (i === 0 && s <= m) continue;
      const when = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${DAY_NAMES[d]}`;
      return { open: false, label: `Cerrada · abre ${when} a las ${hhmm(s)}` };
    }
  }
  return { open: false, label: 'Cerrada' };
}
