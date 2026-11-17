// Peticiones HTTP salientes con timeout y mensajes de error claros.

export class FetchError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    if (cause) this.cause = cause;
  }
}

const TLS_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
]);

export async function fetchJson(url, { timeoutMs = 30000, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const code = err?.cause?.code;
    if (code && TLS_CODES.has(code)) {
      throw new FetchError(
        `Error de certificado TLS al conectar con ${new URL(url).host} (${code}). ` +
          'Prueba a arrancar con NODE_OPTIONS=--use-system-ca o define NODE_EXTRA_CA_CERTS ' +
          'con el certificado intermedio (ver README).',
        { cause: err },
      );
    }
    if (err?.name === 'TimeoutError') {
      throw new FetchError(`Tiempo de espera agotado (${timeoutMs} ms) con ${new URL(url).host}`, { cause: err });
    }
    throw new FetchError(`No se pudo conectar con ${new URL(url).host}: ${code ?? err.message}`, { cause: err });
  }
  if (!res.ok) {
    throw new FetchError(`${new URL(url).host} respondió ${res.status}`, { status: res.status });
  }
  const text = await res.text();
  try {
    // La API del Ministerio a veces antepone un BOM.
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (err) {
    throw new FetchError(`Respuesta no válida (no es JSON) de ${new URL(url).host}`, { cause: err });
  }
}

/** Ejecuta `fn` sobre cada elemento con un máximo de `limit` tareas a la vez. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
