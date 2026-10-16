// -----------------------------------------------------------------------------
// Configuration of the Mercedes-Benz integration.
//
// Fields of the config_schema:
//   - `email` / `password`  the Mercedes me account (password: `secret`);
//   - `region`              the servers of the account: europe,
//                           north_america, asia_pacific;
//   - `pin`                 the security PIN of the app (unlock only);
//   - `session_pause`       minutes between two websocket sessions;
//   - `home_radius`         meters under which a car is home;
//   - `language`            language of the texts written outside a widget
//                           request (device names, text states, scene
//                           texts): `auto` = the language of the last widget
//                           request. Gladys does not send it with a command
//                           or a scene action;
//   - `app_version` / `sdk_version`  overrides of the app identity (Advanced),
//                           for when Mercedes refuses the built-in one (418).
//
// Internal key, outside the config_schema: `last_language`.
// The tokens are kept in /data/session.json (src/mercedes/auth.js).
// -----------------------------------------------------------------------------

import { REGIONS } from './mercedes/constants.js';

const SESSION_PAUSES = ['1', '2', '5', '10', '15', '30'];
const DEFAULT_SESSION_PAUSE = '1';
const HOME_RADIUS = { min: 50, max: 5000, default: 200 };
const LANGUAGES = ['en', 'fr', 'de', 'es'];
const AUTO_LANGUAGE = 'auto';
const REGION_VALUES = Object.values(REGIONS);
const INTERNAL_KEYS = { language: 'last_language' };

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description Read a bounded number field, falling back to its default.
 * @param {unknown} raw - The raw value.
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('300', HOME_RADIUS); // -> 300
 */
function readNumber(raw, bounds) {
  const value = Number(raw ?? bounds.default);
  if (raw === '' || raw === null || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [raw] - The raw values.
 * @returns {object} The config.
 * @example
 * normalizeConfig({ email: 'me@example.com', password: 'x' }).region; // -> 'europe'
 */
function normalizeConfig(raw = {}) {
  const config = raw ?? {};
  const pause = SESSION_PAUSES.includes(String(config.session_pause))
    ? String(config.session_pause)
    : DEFAULT_SESSION_PAUSE;
  return {
    email: readString(config.email),
    password: typeof config.password === 'string' ? config.password : '',
    region: REGION_VALUES.includes(config.region) ? config.region : REGIONS.EUROPE,
    pin: readString(config.pin),
    sessionPauseMinutes: Number(pause),
    homeRadius: readNumber(config.home_radius, HOME_RADIUS),
    language: LANGUAGES.includes(config.language) ? config.language : AUTO_LANGUAGE,
    appVersion: readString(config.app_version),
    sdkVersion: readString(config.sdk_version),
  };
}

/**
 * @description Whether the account is filled in.
 * @param {object} config - The normalized config.
 * @returns {boolean} True with an e-mail and a password.
 */
function hasAccount(config) {
  return Boolean(config.email && config.password);
}

/**
 * @description Read the stored language of the last widget request.
 * @param {object} [raw] - The raw config values.
 * @param {string} fallback - The language to keep otherwise.
 * @returns {string} The language.
 */
function readLanguage(raw, fallback) {
  const language = (raw ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  SESSION_PAUSES,
  DEFAULT_SESSION_PAUSE,
  HOME_RADIUS,
  LANGUAGES,
  AUTO_LANGUAGE,
  REGION_VALUES,
  INTERNAL_KEYS,
  normalizeConfig,
  hasAccount,
  readLanguage,
};
