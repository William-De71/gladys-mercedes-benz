// -----------------------------------------------------------------------------
// Sign-in to the Mercedes me account (CIAM of id.mercedes-benz.com).
//
// The app signs in through web pages, with OAuth2 + PKCE and a custom
// redirect scheme. The steps, as the app (and mbapi2020) runs them:
//   1. GET  /as/authorization.oauth2          -> redirects to a login page
//                                               whose URL holds `resume`;
//   2. POST /ciam/auth/ua                     browser description;
//   3. POST /ciam/auth/login/user             the e-mail;
//   4. POST /ciam/auth/login/pass             the password -> pre-login token;
//      - `passkeyDemoEnabled`: decline the passkey offer
//        (POST /ciam/auth/disablePasskeyDemo), then go on;
//      - GOTO_LOGIN_LEGAL_TEXTS: accept the updated terms
//        (POST /ciam/auth/toas/saveLoginConsent);
//      - GOTO_LOGIN_OTP: the account asks for a code (2FA): not supported;
//   5. POST <resume> with the token           -> rismycar://login-callback?code=
//   6. POST /as/token.oauth2                  code + verifier -> tokens.
//
// The tokens are kept in /data/session.json (with the device id the CIAM
// knows), so a restart does not sign in again: only a refresh, before the
// access token ends. Mercedes ends a session after about 18 hours: the
// integration then signs in again with the stored password (nothing to do
// for the user, which is why 2FA cannot work).
// -----------------------------------------------------------------------------

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  LOGIN_BASE_URL,
  LOGIN_BROWSER_USER_AGENT,
  LOGIN_CLIENT_ID,
  LOGIN_REDIRECT_URI,
  LOGIN_SCOPE,
} from './constants.js';
import { KINDS, MercedesError, kindOfStatus } from './errors.js';
import { createCookieJar, request, requestWithCookies } from './http.js';

// Refresh when less than this is left on the access token.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const GATEWAY_RETRIES = 3;

const base64url = (buffer) => Buffer.from(buffer).toString('base64url');

/**
 * @description A PKCE verifier and its challenge.
 * @returns {{ verifier: string, challenge: string }} The pair.
 */
function createPkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

/**
 * @description The headers of the login web pages.
 * @param {object} [options] - Options.
 * @param {string} [options.accept] - Accept.
 * @param {boolean} [options.referer] - With the referer of the login page.
 * @returns {object} The headers.
 */
function browserHeaders({ accept = 'application/json, text/plain, */*', referer = true } = {}) {
  const headers = {
    accept,
    'content-type': 'application/json',
    origin: LOGIN_BASE_URL,
    'accept-language': 'de-DE,de;q=0.9',
    'user-agent': LOGIN_BROWSER_USER_AGENT,
  };
  if (referer) {
    headers.referer = `${LOGIN_BASE_URL}/ciam/auth/login`;
  }
  return headers;
}

/**
 * @description Read a JSON answer, or fail with the kind of its status.
 * @param {Response} response - The response.
 * @param {string} step - The step, for the message.
 * @returns {Promise<object>} The JSON.
 */
async function jsonOrFail(response, step) {
  const text = await response.text();
  if (!response.ok) {
    // 400/401 on the password step: wrong credentials.
    const kind =
      response.status === 400 || response.status === 401
        ? KINDS.AUTH
        : kindOfStatus(response.status);
    throw new MercedesError(`${step} refused (HTTP ${response.status})`, {
      kind,
      status: response.status,
    });
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new MercedesError(`${step}: unexpected answer`, { kind: KINDS.UNREACHABLE });
  }
}

/**
 * @description The sign-in and the tokens of a Mercedes me account.
 * @param {object} options - Options.
 * @param {Function} [options.fetchImpl] - fetch.
 * @param {object} options.appVersion - createAppVersion().
 * @param {Function} options.getCredentials - `() => ({ email, password })`.
 * @param {string} [options.dataDir] - Where session.json lives.
 * @param {object} [options.logger] - A logger.
 * @param {Function} [options.sleep] - Wait, for the tests.
 * @returns {object} The session manager.
 */
function createAuth({
  fetchImpl = fetch,
  appVersion,
  getCredentials,
  dataDir = '/data',
  logger = null,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const file = path.join(dataDir, 'session.json');
  let session = null;
  let loaded = false;
  let pending = null;

  /**
   * @description Load the stored session once.
   * @returns {Promise<void>}
   */
  async function load() {
    if (loaded) {
      return;
    }
    loaded = true;
    try {
      session = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      session = null;
    }
  }

  /**
   * @description Store the session (atomic write).
   * @returns {Promise<void>}
   */
  async function save() {
    try {
      await mkdir(dataDir, { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify(session), { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    } catch (err) {
      logger?.warn(`Unable to store the session: ${err.message}`);
    }
  }

  const accountKey = () =>
    String(getCredentials().email ?? '')
      .trim()
      .toLowerCase();

  /**
   * @description The device id the CIAM knows this integration by (kept
   * across sign-ins, like the app on a phone).
   * @returns {string} The id.
   */
  function deviceGuid() {
    return session?.deviceGuid ?? randomUUID();
  }

  /**
   * @description Keep the tokens of a token endpoint answer.
   * @param {object} tokens - The answer.
   * @param {string} guid - The device id.
   * @returns {Promise<void>}
   */
  async function keep(tokens, guid) {
    if (!tokens?.access_token) {
      throw new MercedesError('No access token in the answer', { kind: KINDS.AUTH });
    }
    session = {
      account: accountKey(),
      deviceGuid: guid,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? session?.refreshToken ?? null,
      expiresAt: Date.now() + Number(tokens.expires_in ?? 3600) * 1000,
      signedInAt: tokens.refresh_token ? Date.now() : (session?.signedInAt ?? Date.now()),
    };
    await save();
  }

  /**
   * @description A login page request, retried on gateway errors (502-504).
   * @param {Function} send - `() => Promise<{ response }>`.
   * @param {string} step - The step.
   * @returns {Promise<object>} The result of send.
   */
  async function withRetries(send, step) {
    for (let attempt = 1; ; attempt += 1) {
      const result = await send();
      const status = result.response.status;
      if (![502, 503, 504].includes(status) || attempt >= GATEWAY_RETRIES) {
        return result;
      }
      logger?.warn(`${step}: HTTP ${status}, retry ${attempt}/${GATEWAY_RETRIES - 1}`);
      await result.response.arrayBuffer().catch(() => {});
      await sleep(5000 * attempt);
    }
  }

  /**
   * @description Sign in with the e-mail and the password.
   * @returns {Promise<void>}
   * @throws {MercedesError} `auth`, `twoFactor`, `blocked`…
   */
  async function login() {
    const { email, password } = getCredentials();
    if (!email || !password) {
      throw new MercedesError('E-mail and password are required', { kind: KINDS.AUTH });
    }
    const username = String(email).trim();
    const guid = deviceGuid();
    const jar = createCookieJar();
    jar.set('CIAM.DEVICE', guid);
    const { verifier, challenge } = createPkce();
    const post = (url, body, step) =>
      withRetries(
        () =>
          requestWithCookies(fetchImpl, jar, `${LOGIN_BASE_URL}${url}`, {
            method: 'POST',
            headers: browserHeaders(),
            body: JSON.stringify(body),
          }),
        step,
      );

    // 1. Authorization: follow the redirects to the login page.
    const query = new URLSearchParams({
      client_id: LOGIN_CLIENT_ID,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      redirect_uri: LOGIN_REDIRECT_URI,
      response_type: 'code',
      scope: LOGIN_SCOPE,
    });
    const start = await withRetries(
      () =>
        requestWithCookies(fetchImpl, jar, `${LOGIN_BASE_URL}/as/authorization.oauth2?${query}`, {
          headers: {
            'user-agent': LOGIN_BROWSER_USER_AGENT,
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'de-DE,de;q=0.9',
          },
        }),
      'Authorization',
    );
    await start.response.arrayBuffer().catch(() => {});
    if (start.response.status >= 400) {
      throw new MercedesError(`Authorization refused (HTTP ${start.response.status})`, {
        kind: kindOfStatus(start.response.status),
        status: start.response.status,
      });
    }
    const resume = new URL(start.url).searchParams.get('resume');
    if (!resume) {
      throw new MercedesError('The login page changed (no resume parameter)', {
        kind: KINDS.UNREACHABLE,
      });
    }

    // 2. Browser description (failures ignored, as the app does).
    await requestWithCookies(fetchImpl, jar, `${LOGIN_BASE_URL}/ciam/auth/ua`, {
      method: 'POST',
      headers: browserHeaders({ accept: '*/*', referer: false }),
      body: JSON.stringify({
        browserName: 'Mobile Safari',
        browserVersion: '15.6.6',
        osName: 'iOS',
      }),
    })
      .then(({ response }) => response.arrayBuffer())
      .catch(() => {});

    // 3. E-mail.
    const user = await post('/ciam/auth/login/user', { username }, 'E-mail');
    await jsonOrFail(user.response, 'E-mail');

    // 4. Password.
    const rid = base64url(randomBytes(24));
    const credentials = { username, password, rememberMe: false, rid };
    let result = await jsonOrFail(
      (await post('/ciam/auth/login/pass', credentials, 'Password')).response,
      'Password',
    );
    if (result.passkeyDemoEnabled) {
      logger?.info('Declining the passkey offer of the Mercedes sign-in');
      result = await jsonOrFail(
        (
          await post(
            '/ciam/auth/disablePasskeyDemo',
            { ...credentials, disablePasskeyDemo: true },
            'Passkey offer',
          )
        ).response,
        'Passkey offer',
      );
    }
    if (result.result === 'GOTO_LOGIN_OTP') {
      throw new MercedesError('The account asks for a code (two-factor authentication)', {
        kind: KINDS.TWO_FACTOR,
      });
    }
    if (result.result === 'GOTO_LOGIN_LEGAL_TEXTS') {
      logger?.info('Accepting the updated terms of the Mercedes me account');
      result = await jsonOrFail(
        (
          await post(
            '/ciam/auth/toas/saveLoginConsent',
            {
              texts: {},
              homeCountry: result.homeCountry ?? '',
              consentCountry: result.consentCountry ?? '',
            },
            'Terms',
          )
        ).response,
        'Terms',
      );
    }
    if (result.result !== 'RESUME2OIDCP' || !result.token) {
      throw new MercedesError(`Unexpected sign-in step: ${result.result ?? 'none'}`, {
        kind: KINDS.AUTH,
      });
    }

    // 5. Resume: the end of the redirects is the app callback with the code.
    const resumed = await requestWithCookies(fetchImpl, jar, `${LOGIN_BASE_URL}${resume}`, {
      method: 'POST',
      headers: {
        ...browserHeaders({
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: result.token }).toString(),
    });
    const code = resumed.location ? new URL(resumed.location).searchParams.get('code') : null;
    if (!code) {
      await resumed.response.arrayBuffer().catch(() => {});
      throw new MercedesError('No authorization code after the sign-in', { kind: KINDS.AUTH });
    }

    // 6. Tokens.
    const response = await request(fetchImpl, `${LOGIN_BASE_URL}/as/token.oauth2`, {
      method: 'POST',
      headers: {
        ...appVersion.oauthHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: LOGIN_CLIENT_ID,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: LOGIN_REDIRECT_URI,
      }).toString(),
    });
    await keep(await jsonOrFail(response, 'Token'), guid);
    logger?.info('Signed in to the Mercedes me account');
  }

  /**
   * @description Refresh the access token.
   * @returns {Promise<void>}
   */
  async function refresh() {
    await appVersion.refresh();
    const response = await request(fetchImpl, `${LOGIN_BASE_URL}/as/token.oauth2`, {
      method: 'POST',
      headers: {
        ...appVersion.oauthHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Device-Id': session.deviceGuid,
        'X-Request-Id': randomUUID(),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: session.refreshToken,
      }).toString(),
    });
    await keep(await jsonOrFail(response, 'Token refresh'), session.deviceGuid);
  }

  /**
   * @description A valid access token: the stored one, refreshed, or a new
   * sign-in. One at a time.
   * @param {object} [options] - Options.
   * @param {boolean} [options.force] - Renew even if still valid.
   * @returns {Promise<string>} The access token.
   */
  async function accessToken({ force = false } = {}) {
    if (pending) {
      return pending;
    }
    pending = (async () => {
      await load();
      if (session && session.account !== accountKey()) {
        session = { deviceGuid: session.deviceGuid };
      }
      const fresh = session?.accessToken && session.expiresAt - Date.now() > REFRESH_MARGIN_MS;
      if (fresh && !force) {
        return session.accessToken;
      }
      if (session?.refreshToken) {
        try {
          await refresh();
          return session.accessToken;
        } catch (err) {
          if (err.kind !== KINDS.AUTH) {
            throw err;
          }
          logger?.info('Refresh token refused: signing in again');
        }
      }
      await login();
      return session.accessToken;
    })().finally(() => {
      pending = null;
    });
    return pending;
  }

  /**
   * @description Forget the tokens (keeps the device id).
   * @returns {Promise<void>}
   */
  async function clear() {
    await load();
    session = session ? { deviceGuid: session.deviceGuid } : null;
    await save();
  }

  return {
    accessToken,
    login,
    clear,
    hasSession: () => Boolean(session?.accessToken),
    sessionAge: () => (session?.signedInAt ? Date.now() - session.signedInAt : null),
  };
}

export { createAuth, createPkce };
