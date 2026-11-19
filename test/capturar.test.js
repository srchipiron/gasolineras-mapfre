import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { bookmarklet, isMapfreOrigin } from '../shared/capturar.js';
import { combineOfficial, diffOfficial } from '../shared/treboles.js';
import { parseLocatorPayload } from '../shared/locator.js';
import { createCaptureStore } from '../server/capturas.js';

const APP = 'https://treboles.onrender.com';
const RESPUESTA = { message: { contenido: [
  { nombreCentro: 'CRED ALBERTO AGUILERA', latitud: '40.43', longitud: '-3.71', codigoTipoColaborador: 4, direccion: 'CL ALBERTO AGUILERA 9' },
  { nombreCentro: 'ES GESLAMA', latitud: '40.44', longitud: '-3.70', codigoTipoColaborador: 3, direccion: 'CL BRAVO MURILLO 12' },
] } };

/** Una página del mapa oficial de mentira: XHR, ventanas y subida a Tréboles. */
function fakeMapfrePage({ upload = async () => ({ ok: true, status: 200, json: async () => ({ id: 'codigo123456', count: 2 }) }) } = {}) {
  const opened = [];
  const uploads = [];
  const nodes = {};
  let box = null;
  const el = () => ({
    style: {},
    _html: '',
    setAttribute() {},
    set innerHTML(h) { this._html = h; },
    get innerHTML() { return this._html; },
    querySelector(sel) {
      const attr = sel.slice(1, -1);
      if (attr !== 'data-x' && !this._html.includes(attr)) return null;
      return (nodes[sel] ??= { onclick: null });
    },
  });
  class XMLHttpRequest {
    constructor() { this.l = {}; this.responseType = ''; }
    open() {}
    send() {}
    addEventListener(t, f) { this.l[t] = f; }
  }
  const win = {
    location: { hostname: 'www.mapfretecuidamos.com' },
    document: {
      getElementById: () => box,
      createElement: () => (box = el()),
      body: { appendChild() {} },
    },
    XMLHttpRequest,
    confirm: () => false,
    open: (url, name) => { opened.push({ url, name }); return {}; },
    fetch: (url, init) => { uploads.push({ url, init }); return upload(); },
    encodeURIComponent,
    String,
    Error,
    JSON,
  };
  win.window = win;
  return { win, opened, uploads, box: () => box, nodes };
}

const code = (url) => decodeURIComponent(url.slice('javascript:'.length));
const tick = () => new Promise((r) => setTimeout(r, 0));

/** El mapa hace su búsqueda (XHR a collaborating-center). */
function mapSearch(page, body = RESPUESTA) {
  const xhr = new page.win.XMLHttpRequest();
  xhr.open('POST', '/serviciostecuidamos/collaborating-center');
  xhr.send('{}');
  xhr.responseText = JSON.stringify(body);
  xhr.l.load();
}

test('el marcador lee la lista que descarga el mapa, la sube a Tréboles y abre la app con el código', async () => {
  const url = bookmarklet(APP);
  assert.match(url, /^javascript:/);
  assert.ok(!code(url).includes('\n'), 'una sola línea');
  const page = fakeMapfrePage();
  vm.runInNewContext(code(url), page.win);
  assert.match(page.box().innerHTML, /buscador del mapa/);

  mapSearch(page);
  assert.match(page.box().innerHTML, /Preparando/);
  assert.equal(page.uploads.length, 1);
  assert.equal(page.uploads[0].url, `${APP}/api/adheridas/captura`);
  assert.equal(parseLocatorPayload(JSON.parse(page.uploads[0].init.body)).length, 2);
  await tick();
  await tick();
  assert.match(page.box().innerHTML, /Leídas <b>2<\/b>/);

  page.nodes['[data-enviar]'].onclick();
  assert.deepEqual(page.opened, [{ url: `${APP}/?accion=importar-mapa&captura=codigo123456`, name: 'treboles' }]);
  assert.match(page.box().innerHTML, /Enviadas/);
});

test('si Tréboles no responde, el marcador lo dice y deja reintentar', async () => {
  const page = fakeMapfrePage({ upload: async () => { throw new Error('Failed to fetch'); } });
  vm.runInNewContext(code(bookmarklet(APP)), page.win);
  mapSearch(page);
  await tick();
  await tick();
  assert.match(page.box().innerHTML, /No se pudo conectar/);
  page.nodes['[data-reintentar]'].onclick();
  assert.equal(page.uploads.length, 2);
});

test('el marcador fuera del mapa oficial no hace nada (salvo ofrecer abrirlo)', () => {
  const page = fakeMapfrePage();
  page.win.location.hostname = 'treboles.onrender.com';
  vm.runInNewContext(code(bookmarklet(APP)), page.win);
  assert.equal(page.box(), null);
});

test('solo se aceptan subidas del mapa oficial', () => {
  assert.ok(isMapfreOrigin('https://www.mapfretecuidamos.com'));
  assert.ok(isMapfreOrigin('https://mapfretecuidamos.com'));
  assert.ok(!isMapfreOrigin('https://mapfretecuidamos.com.evil.example'));
  assert.ok(!isMapfreOrigin('http://www.mapfretecuidamos.com'));
  assert.ok(!isMapfreOrigin(undefined));
});

test('las listas subidas se recogen una vez y caducan', () => {
  let t = 0;
  const store = createCaptureStore({ ttlMs: 1000, max: 2, now: () => t });
  const a = store.put([1]);
  assert.deepEqual(store.take(a), [1]);
  assert.equal(store.take(a), null, 'una sola vez');
  const b = store.put([2]);
  t = 2000;
  assert.equal(store.take(b), null, 'caducada');
  store.put([3]); store.put([4]); store.put([5]);
  assert.equal(store.size, 2, 'como mucho unas pocas en memoria');
});

test('una importación de toda España sustituye a la lista (si es más reciente) y se ve qué cambia', () => {
  const server = { updatedAt: '2026-11-19', provinces: ['28'], stations: { A: { tipo: 'repsol', nombre: 'A' }, B: { tipo: 'colaboradora', nombre: 'B' }, C: { tipo: 'colaboradora', nombre: 'C' } } };
  const local = { updatedAt: '2026-11-20', completa: true, provinces: ['28'], stations: { A: { tipo: 'repsol', nombre: 'A' }, C: { tipo: 'repsol', nombre: 'C' }, D: { tipo: 'colaboradora', nombre: 'D' } } };
  assert.deepEqual(Object.keys(combineOfficial(server, local).stations).sort(), ['A', 'C', 'D'], 'B ya no está');
  // Si el servidor publica después una lista más nueva, manda la del servidor.
  assert.deepEqual(Object.keys(combineOfficial({ ...server, updatedAt: '2026-12-01' }, local).stations).sort(), ['A', 'B', 'C']);
  // Una importación parcial se suma.
  assert.deepEqual(Object.keys(combineOfficial(server, { ...local, completa: false }).stations).sort(), ['A', 'B', 'C', 'D']);

  const matched = Object.entries(local.stations).map(([id, v]) => ({ id, ...v }));
  const d = diffOfficial({ stations: { ...server.stations, M: { tipo: 'manual', nombre: '' } } }, matched);
  assert.deepEqual(d.nuevas.map((x) => x.id), ['D']);
  assert.deepEqual(d.quitadas.map((x) => x.id), ['B'], 'las marcadas a mano no cuentan como quitadas');
  assert.deepEqual(d.cambian.map((x) => [x.id, x.antes, x.tipo]), [['C', 'colaboradora', 'repsol']]);
});
