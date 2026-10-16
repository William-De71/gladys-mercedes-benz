// -----------------------------------------------------------------------------
// The transport badge of each car (Devices screen of Gladys).
//
// Everything goes through the Mercedes cloud: the badge says `cloud` while
// the account is read, `unreachable` when Mercedes refuses it (wrong
// password, outdated app, unreachable servers). While Mercedes blocks the
// websocket (429), the values come from the slower REST fallback: still
// `cloud`, flagged `degraded` with the reason.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { all } from './i18n.js';

/**
 * @description The transport entry of a car.
 * @param {string} externalId - The device external id.
 * @param {string} state - The account state: connected, idle, blocked,
 * outdated, auth, error, stopped.
 * @returns {object} The `publishTransports` entry.
 * @example
 * transportOf('ext:mercedes-benz:vehicle:W1N…', 'idle');
 */
function transportOf(externalId, state) {
  if (state === 'blocked') {
    return {
      external_id: externalId,
      transport: DEVICE_TRANSPORTS.CLOUD,
      degraded: true,
      message: all('transportBlocked'),
    };
  }
  if (['outdated', 'auth', 'error'].includes(state)) {
    return { external_id: externalId, transport: DEVICE_TRANSPORTS.UNREACHABLE };
  }
  return { external_id: externalId, transport: DEVICE_TRANSPORTS.CLOUD };
}

export { transportOf };
