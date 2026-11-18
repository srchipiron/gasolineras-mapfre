import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayAverages, trendSummary, TrendStore } from '../server/tendencia.js';
import { madridDate } from '../server/store.js';
import { generateDemoDayResponse } from '../server/demo.js';

const st = (idProvincia, prices, saleType = 'P') => ({ idProvincia, prices, saleType });

test('media por provincia y en España, sin las de venta restringida', () => {
  const avg = dayAverages([
    st('41', { gasoleoA: 1.4, gasolina95: 1.6 }),
    st('41', { gasoleoA: 1.5 }),
    st('04', { gasoleoA: 1.3 }),
    st('04', { gasoleoA: 0.9 }, 'R'),
  ]);
  assert.equal(avg['41'].gasoleoA, 1.45);
  assert.equal(avg['41'].gasolina95, 1.6);
  assert.equal(avg['04'].gasoleoA, 1.3);
  assert.equal(avg.ES.gasoleoA, 1.4);
});

test('resumen de la tendencia de la última semana', () => {
  const day = (i) => `2026-11-${String(i).padStart(2, '0')}`;
  const down = Array.from({ length: 15 }, (_, i) => ({ date: day(i + 4), avg: 1.5 - i * 0.002 }));
  const s = trendSummary(down);
  assert.equal(s.trend, 'down');
  assert.equal(s.days, 7);
  assert.equal(s.change, -0.014);
  const flat = down.map((p) => ({ ...p, avg: 1.45 }));
  assert.equal(trendSummary(flat).trend, 'flat');
  const up = down.map((p, i) => ({ ...p, avg: 1.4 + i * 0.003 }));
  assert.equal(trendSummary(up).trend, 'up');
  // Con huecos usa el día más cercano a hace una semana.
  const gaps = [{ date: day(10), avg: 1.5 }, { date: day(11), avg: null }, { date: day(18), avg: 1.48 }];
  assert.deepEqual({ ...trendSummary(gaps), last: undefined, ref: undefined }, { last: undefined, ref: undefined, change: -0.02, trend: 'down', days: 8 });
  assert.equal(trendSummary([{ date: day(1), avg: 1.4 }]).trend, null);
});

test('el almacén descarga los días que faltan, uno a uno, y monta la serie', async () => {
  const now = new Date('2026-11-18T10:00:00Z');
  const asked = [];
  const trend = new TrendStore({
    loadDay: async (date) => { asked.push(date.getDate()); return generateDemoDayResponse(date, now); },
    days: 3, delayMs: 0, logger: { info() {}, warn() {} },
  });
  trend.addDay(madridDate(now, -2), [st('28', { gasoleoA: 1.5 })]);
  assert.deepEqual(trend.missing(now), [madridDate(now, -1), madridDate(now, -3)]);
  await trend.fill(now);
  assert.deepEqual(asked, [17, 15]);
  assert.deepEqual(trend.missing(now), []);
  const series = trend.series({ province: '28', fuel: 'gasoleoA', today: { 28: { gasoleoA: 1.45 }, ES: { gasoleoA: 1.46 } }, now });
  assert.equal(series.length, 4);
  assert.equal(series[1].avg, 1.5);
  assert.equal(series.at(-1).avg, 1.45);
  assert.equal(series.at(-1).date, madridDate(now));
});

test('si una descarga falla, para y lo reintenta más tarde', async () => {
  const now = new Date('2026-11-18T10:00:00Z');
  let calls = 0;
  const trend = new TrendStore({ loadDay: async () => { calls++; throw new Error('sin red'); }, days: 5, delayMs: 0, logger: { info() {}, warn() {} } });
  await trend.fill(now);
  assert.equal(calls, 1);
  assert.equal(trend.missing(now).length, 5);
});
