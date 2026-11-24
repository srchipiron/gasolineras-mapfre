// Reparto de pines en el mapa para que no se tapen las gasolineras que están
// casi en el mismo sitio (p. ej. una a cada lado de una autovía, o dos en la
// misma calle). Sin esto, la de debajo no se ve hasta acercar muchísimo.

import { haversineKm } from './geo.js';

/** A menos de esta distancia real se considera que «están juntas». */
export const NEAR_KM = 0.3;

/**
 * Calcula cuánto bajar o subir (en píxeles) cada pin para que no tape a otro
 * que está a menos de `nearKm`. Los pines se colocan en el orden recibido (el
 * primero, el más importante, nunca se mueve). Los que se solapan con otro
 * lejano no se mueven: esos se separan al acercar el mapa.
 *
 * @param {{x:number,y:number,w:number,h:number,ay:number,lat:number,lon:number}[]} pins
 *   x, y: posición en píxeles del punto; w, h: tamaño del pin; ay: su ancla vertical.
 * @returns {number[]} desplazamiento vertical de cada pin, en el mismo orden.
 */
/**
 * Decide qué pines llevan etiqueta de precio sin que se pisen: se recorren en
 * orden de importancia y, si la etiqueta de uno tapa la de otro ya puesto que
 * está lejos de verdad, ese pasa a ser un punto (al acercar el mapa vuelve a
 * salir su precio). Los que están casi en el mismo sitio no se quitan: esos los
 * separa `spreadPins`. Los marcados con `keep` siempre llevan etiqueta.
 *
 * @param {{x:number,y:number,w:number,h:number,ay:number,lat:number,lon:number,labelled:boolean,keep?:boolean}[]} pins
 * @returns {boolean[]} si cada pin lleva etiqueta, en el mismo orden.
 */
export function declutterLabels(pins, { nearKm = NEAR_KM, gap = 2 } = {}) {
  const shown = [];
  const box = (p) => ({ x1: p.x - p.w / 2 - gap, x2: p.x + p.w / 2 + gap, y1: p.y - p.ay - gap, y2: p.y - p.ay + p.h + gap });
  const overlaps = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  return pins.map((p) => {
    if (!p.labelled) return false;
    const b = box(p);
    const hidden = !p.keep && shown.some((q) => overlaps(b, q.box) && haversineKm(p.lat, p.lon, q.lat, q.lon) > nearKm);
    if (hidden) return false;
    shown.push({ lat: p.lat, lon: p.lon, box: b });
    return true;
  });
}

export function spreadPins(pins, { nearKm = NEAR_KM, gap = 8, maxSteps = 4 } = {}) {
  const placed = [];
  const overlaps = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  const box = (p, dy) => ({ x1: p.x - p.w / 2, x2: p.x + p.w / 2, y1: p.y - p.ay + dy, y2: p.y - p.ay + dy + p.h });
  return pins.map((p) => {
    const near = (q) => haversineKm(p.lat, p.lon, q.lat, q.lon) <= nearKm;
    let dy = 0;
    for (let k = 1, b = box(p, 0); k <= maxSteps * 2; k++) {
      if (!placed.some((q) => near(q) && overlaps(b, q.box))) break;
      // 0, abajo, arriba, más abajo, más arriba…
      const step = Math.ceil(k / 2) * (k % 2 ? 1 : -1);
      dy = step * (p.h + gap);
      b = box(p, dy);
    }
    placed.push({ lat: p.lat, lon: p.lon, box: box(p, dy) });
    return dy;
  });
}
