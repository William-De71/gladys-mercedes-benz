// -----------------------------------------------------------------------------
// A small HTTP layer over fetch: timeouts, and a cookie jar with manual
// redirects for the sign-in pages (fetch keeps no cookies, and the sign-in
// pages set some on each redirect).
// -----------------------------------------------------------------------------

import { KINDS, MercedesError } from './errors.js';

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 10;

/**
 * @description A cookie jar: name -> value, for one sign-in.
 * @returns {{ header: Function, store: Function, set: Function }} The jar.
 */
function createCookieJar() {
  const cookies = new Map();
  return {
    set(name, value) {
      cookies.set(name, value);
    },
    /**
     * @param {Response} response - A response whose Set-Cookie to keep.
     */
    store(response) {
      const lines =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [response.headers.get('set-cookie')].filter(Boolean);
      for (const line of lines) {
        const [pair] = line.split(';');
        const index = pair.indexOf('=');
        if (index > 0) {
          cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
        }
      }
    },
    header() {
      return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
    },
  };
}

/**
 * @description fetch with a timeout; a network failure becomes an
 * `unreachable` MercedesError.
 * @param {Function} fetchImpl - fetch.
 * @param {string} url - The URL.
 * @param {object} [init] - fetch options, plus `timeoutMs`.
 * @returns {Promise<Response>} The response.
 */
async function request(fetchImpl, url, { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = {}) {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return 'Mercedes';
      }
    })();
    throw new MercedesError(`${host} unreachable: ${err.cause?.code ?? err.message}`, {
      kind: KINDS.UNREACHABLE,
    });
  }
}

/**
 * @description A request through a cookie jar, following redirects by hand
 * until a final answer, or until a redirect to a non-HTTP scheme (the app
 * callback `rismycar://…`), returned as `{ location }`.
 * @param {Function} fetchImpl - fetch.
 * @param {object} jar - The cookie jar.
 * @param {string} url - The URL.
 * @param {object} [init] - fetch options.
 * @returns {Promise<{ response: Response, url: string, location: string|null }>} The end.
 */
async function requestWithCookies(fetchImpl, jar, url, init = {}) {
  let current = url;
  let options = init;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const headers = { ...(options.headers ?? {}) };
    const cookie = jar.header();
    if (cookie) {
      headers.cookie = cookie;
    }
    const response = await request(fetchImpl, current, {
      ...options,
      headers,
      redirect: 'manual',
    });
    jar.store(response);
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      return { response, url: current, location: null };
    }
    await response.arrayBuffer().catch(() => {});
    if (!/^https?:/i.test(location) && !location.startsWith('/')) {
      return { response, url: current, location };
    }
    current = new URL(location, current).toString();
    // A redirect after a POST is a GET, without the body.
    options = { headers: init.headers, method: 'GET' };
  }
  throw new MercedesError('Too many redirects during the sign-in', { kind: KINDS.UNREACHABLE });
}

export { DEFAULT_TIMEOUT_MS, createCookieJar, request, requestWithCookies };
