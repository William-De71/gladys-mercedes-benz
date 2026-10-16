// -----------------------------------------------------------------------------
// The version of the Mercedes me app the integration announces.
//
// Mercedes refuses an app it considers too old (HTTP 418 "I'm a teapot", or
// a websocket closed at once). The app config endpoint says when an update
// is due (`forceUpdate.status` FORCE or INFORM_ALWAYS) with the App Store
// link: the integration then reads the current version from the public App
// Store lookup, like mbapi2020 does, at most every 6 hours. The user can also
// override the app and SDK versions (Advanced settings).
// -----------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import {
  APP_USER_AGENT,
  OS_NAME,
  OS_VERSION,
  SDK_VERSION,
  LOCALE,
  PROFILES,
  REGIONS,
} from './constants.js';
import { request } from './http.js';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_STATUSES = new Set(['FORCE', 'INFORM_ALWAYS']);

/**
 * @description The app identity of a region, refreshed from the App Store.
 * @param {object} options - Options.
 * @param {string} options.region - One of REGIONS.
 * @param {Function} [options.fetchImpl] - fetch.
 * @param {Function} [options.getOverrides] - `() => ({ appVersion, sdkVersion })`.
 * @param {object} [options.logger] - A logger.
 * @returns {object} The identity.
 */
function createAppVersion({ region, fetchImpl = fetch, getOverrides = () => ({}), logger = null }) {
  const profile = PROFILES[region] ?? PROFILES[REGIONS.EUROPE];
  let discovered = null;
  let checkedAt = 0;

  const version = () => getOverrides().appVersion || discovered || profile.appVersion;
  const sdk = () => getOverrides().sdkVersion || SDK_VERSION;

  /**
   * @description Headers common to the sign-in token calls.
   * @returns {object} The headers.
   */
  function oauthHeaders() {
    return {
      'Ris-Os-Name': OS_NAME,
      'Ris-Os-Version': OS_VERSION,
      'Ris-Sdk-Version': sdk(),
      'Ris-Application-Version': version(),
      'X-Applicationname': profile.appName,
      'X-Locale': LOCALE,
      'X-Trackingid': randomUUID(),
      'User-Agent': profile.oauthUserAgent(version(), sdk()),
      'Accept-Language': LOCALE,
    };
  }

  /**
   * @description Headers of the REST API.
   * @param {string} sessionId - The app session id.
   * @returns {object} The headers.
   */
  function restHeaders(sessionId) {
    return {
      'X-SessionId': sessionId,
      'X-TrackingId': randomUUID().toUpperCase(),
      'X-ApplicationName': profile.appName,
      'ris-application-version': version(),
      'ris-os-name': OS_NAME,
      'ris-os-version': OS_VERSION,
      'ris-sdk-version': sdk(),
      'X-Locale': 'de-DE',
      'User-Agent': APP_USER_AGENT,
    };
  }

  /**
   * @description Headers of the websocket handshake.
   * @param {string} sessionId - The app session id.
   * @returns {object} The headers (without the token).
   */
  function websocketHeaders(sessionId) {
    const headers = {
      'APP-SESSION-ID': sessionId,
      'OUTPUT-FORMAT': 'PROTO',
      'X-SessionId': sessionId,
      'X-TrackingId': randomUUID().toUpperCase(),
      'X-ApplicationName': profile.appName,
      'ris-application-version': version(),
      'ris-os-name': OS_NAME,
      'ris-os-version': OS_VERSION,
      'ris-sdk-version': sdk(),
      'X-Locale': profile.locale ?? 'de-DE',
      'User-Agent': profile.websocketUserAgent(version(), sdk()),
    };
    return headers;
  }

  /**
   * @description Ask the app config whether an update is due, and read the
   * current version from the App Store when it is. Never throws.
   * @param {object} [options] - Options.
   * @param {boolean} [options.force] - Even if checked recently.
   * @returns {Promise<boolean>} True when the version changed.
   */
  async function refresh({ force = false } = {}) {
    if (!force && Date.now() - checkedAt < CHECK_INTERVAL_MS) {
      return false;
    }
    checkedAt = Date.now();
    try {
      const response = await request(fetchImpl, `${profile.rest}/v1/config`, {
        headers: { ...oauthHeaders(), 'X-Sessionid': randomUUID() },
        timeoutMs: 10000,
      });
      if (!response.ok) {
        await response.arrayBuffer().catch(() => {});
        return false;
      }
      const config = await response.json();
      const status = config?.forceUpdate?.status;
      if (!UPDATE_STATUSES.has(status)) {
        return false;
      }
      const id = /\/id(\d+)/.exec(String(config.forceUpdate.storeUrl ?? ''))?.[1];
      if (!id) {
        return false;
      }
      const lookup = await request(
        fetchImpl,
        `https://itunes.apple.com/lookup?id=${id}&country=${profile.storeCountry}`,
        { timeoutMs: 10000 },
      );
      const next = (await lookup.json())?.results?.[0]?.version;
      if (typeof next !== 'string' || next === version()) {
        return false;
      }
      logger?.info(`Mercedes asks for a newer app (${status}): announcing ${next}`);
      discovered = next;
      return true;
    } catch (err) {
      logger?.debug?.(`App version check failed: ${err.message}`);
      return false;
    }
  }

  return {
    profile,
    version,
    sdk,
    oauthHeaders,
    restHeaders,
    websocketHeaders,
    refresh,
  };
}

export { createAppVersion };
