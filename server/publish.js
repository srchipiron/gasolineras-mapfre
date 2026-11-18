// Publicar la lista de adheridas para todos los usuarios: se guarda en
// config/adheridas.json del servidor (efecto inmediato) y, si hay un token de
// GitHub configurado, se sube al repositorio para que sobreviva a los
// reinicios y despliegues de Render.

import { createHash, timingSafeEqual } from 'node:crypto';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Compara la clave de administrador sin filtrar su longitud ni su contenido por tiempos. */
export function checkAdminKey(given, expected) {
  if (!expected || typeof given !== 'string' || !given) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

/** Limita los intentos fallidos de clave (por IP) para que no se pueda adivinar. */
export function createAttemptLimiter({ max = 5, windowMs = 15 * 60 * 1000, now = () => Date.now() } = {}) {
  const fails = new Map();
  const recent = (ip) => (fails.get(ip) ?? []).filter((t) => now() - t < windowMs);
  return {
    blocked: (ip) => recent(ip).length >= max,
    fail: (ip) => fails.set(ip, [...recent(ip), now()]),
    reset: (ip) => fails.delete(ip),
  };
}

export async function writeJsonAtomic(file, data) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tmp, file);
}

/**
 * Sube (crea o sustituye) un fichero en un repositorio de GitHub.
 * @returns {Promise<{ commit: string|null, url: string|null }>}
 */
export async function commitToGitHub({ token, repo, branch = 'main', path, content, message, fetchImpl = fetch }) {
  if (!/^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/.test(repo ?? '')) throw new Error('GITHUB_REPO no válido (usa propietario/repositorio)');
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gasolineras-mapfre',
  };
  let sha;
  const cur = await fetchImpl(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (cur.ok) sha = (await cur.json()).sha;
  else if (cur.status !== 404) throw new Error(`GitHub respondió ${cur.status} al leer ${path}`);
  const res = await fetchImpl(api, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, branch, content: Buffer.from(content).toString('base64'), ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`GitHub respondió ${res.status}${body.message ? `: ${body.message}` : ''}`);
  }
  const body = await res.json();
  return { commit: body.commit?.sha ?? null, url: body.commit?.html_url ?? null };
}
