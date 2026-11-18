import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAdminKey, createAttemptLimiter, commitToGitHub } from '../server/publish.js';
import { createHttpServer } from '../server/app.js';
import { StationStore } from '../server/store.js';
import { createOfficialSource } from '../server/adheridas.js';
import { createDemoGeocoder, createDemoRouter, createDemoHistory } from '../server/demo.js';

const quiet = { info() {}, warn() {}, error() {} };
const raw = JSON.parse(readFileSync(new URL('./fixtures/minetur-sample.json', import.meta.url)));

test('clave de administrador', () => {
  assert.equal(checkAdminKey('secreta', 'secreta'), true);
  assert.equal(checkAdminKey('secreto', 'secreta'), false);
  assert.equal(checkAdminKey('', 'secreta'), false);
  assert.equal(checkAdminKey('x', ''), false, 'sin clave configurada nunca se acepta');
  assert.equal(checkAdminKey(undefined, 'secreta'), false);
});

test('límite de intentos fallidos', () => {
  let t = 0;
  const l = createAttemptLimiter({ max: 3, windowMs: 1000, now: () => t });
  for (let i = 0; i < 3; i++) l.fail('a');
  assert.equal(l.blocked('a'), true);
  assert.equal(l.blocked('b'), false);
  t = 1500;
  assert.equal(l.blocked('a'), false, 'pasado el tiempo se puede volver a intentar');
});

test('sube el fichero a GitHub con el sha anterior', async () => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : null, auth: opts.headers?.Authorization });
    if (!opts.method) return new Response(JSON.stringify({ sha: 'abc' }), { status: 200 });
    return new Response(JSON.stringify({ commit: { sha: 'def', html_url: 'https://github.com/x/y/commit/def' } }), { status: 200 });
  };
  const r = await commitToGitHub({ token: 't0k', repo: 'x/y', branch: 'main', path: 'config/adheridas.json', content: '{"a":1}\n', message: 'm', fetchImpl });
  assert.deepEqual(r, { commit: 'def', url: 'https://github.com/x/y/commit/def' });
  assert.equal(calls[0].url, 'https://api.github.com/repos/x/y/contents/config/adheridas.json?ref=main');
  assert.equal(calls[1].method, 'PUT');
  assert.equal(calls[1].body.sha, 'abc');
  assert.equal(Buffer.from(calls[1].body.content, 'base64').toString(), '{"a":1}\n');
  assert.equal(calls[1].auth, 'Bearer t0k');
  await assert.rejects(commitToGitHub({ token: 't', repo: '../malo', path: 'p', content: '', message: 'm', fetchImpl }), /GITHUB_REPO no válido/);
  const denied = async () => new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 });
  await assert.rejects(commitToGitHub({ token: 't', repo: 'x/y', path: 'p', content: '', message: 'm', fetchImpl: denied }), /401/);
});

async function startServer(publish, officialFile) {
  const store = new StationStore({ load: async () => raw, refreshMs: 0, logger: quiet });
  await store.init();
  const server = createHttpServer({
    store, geocoder: createDemoGeocoder(), router: createDemoRouter(), history: createDemoHistory(), logger: quiet,
    official: createOfficialSource(officialFile), publish,
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const post = (base, body) => fetch(`${base}/api/adheridas/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, body: await r.json() }));

test('publicar la lista para todos desde la app', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'publicar-')), 'adheridas.json');
  const { server, base } = await startServer({ adminKey: 'clave-larga', officialFile: file, github: null }, file);
  try {
    const list = { stations: { 1001: { tipo: 'colaboradora', nombre: 'GALP' }, 1003: { tipo: 'repsol', nombre: 'REPSOL' }, 'mal id': { tipo: 'repsol' } } };
    assert.equal((await post(base, { key: 'otra', list })).status, 403);
    assert.equal((await post(base, { key: 'clave-larga', list: { stations: {} } })).status, 400);
    const ok = await post(base, { key: 'clave-larga', list });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.stations, 2);
    assert.match(ok.body.warning, /GITHUB_TOKEN/);
    const shared = await (await fetch(`${base}/api/adheridas`)).json();
    assert.deepEqual(Object.keys(shared.stations).sort(), ['1001', '1003'], 'todos los usuarios reciben la lista nueva');
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.equal(status.canPublish, true);
    assert.equal(status.publishPersists, false);
    // Demasiados intentos con clave mala desde la misma IP
    for (let i = 0; i < 5; i++) await post(base, { key: 'mala', list });
    assert.equal((await post(base, { key: 'clave-larga', list })).status, 429);
  } finally {
    server.close();
  }
});

test('sin ADMIN_KEY no se puede publicar', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'publicar-')), 'adheridas.json');
  const { server, base } = await startServer(null, file);
  try {
    const r = await post(base, { key: 'x', list: { stations: { 1001: { tipo: 'colaboradora' } } } });
    assert.equal(r.status, 503);
    assert.match(r.body.error, /ADMIN_KEY/);
  } finally {
    server.close();
  }
});
