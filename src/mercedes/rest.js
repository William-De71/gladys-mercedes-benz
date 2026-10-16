// -----------------------------------------------------------------------------
// The REST API of the Mercedes me app ("BFF").
//
//   GET /v2/vehicles                           the cars of the account
//   GET /v1/vehicle/<VIN>/capabilities          features of the car
//   GET /v1/vehicle/<VIN>/capabilities/commands the remote commands it accepts
//   GET <widget>/v1/vehicle/<VIN>/vehicleattributes
//                                               every attribute at once, in
//                                               protobuf: the fallback while
//                                               the websocket is refused
// -----------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { KINDS, MercedesError, kindOfStatus } from './errors.js';
import { request } from './http.js';

/**
 * @description The REST client.
 * @param {object} options - Options.
 * @param {Function} [options.fetchImpl] - fetch.
 * @param {object} options.auth - createAuth().
 * @param {object} options.appVersion - createAppVersion().
 * @param {string} [options.sessionId] - The app session id.
 * @returns {object} The client.
 */
function createRest({
  fetchImpl = fetch,
  auth,
  appVersion,
  sessionId = randomUUID().toUpperCase(),
}) {
  /**
   * @description A GET, with one token renewal on 401.
   * @param {string} url - The URL.
   * @param {object} [options] - Options.
   * @param {boolean} [options.binary] - Return the bytes, not JSON.
   * @returns {Promise<object|Buffer>} The answer.
   */
  async function get(url, { binary = false } = {}) {
    await appVersion.refresh();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await auth.accessToken({ force: attempt > 0 });
      const response = await request(fetchImpl, url, {
        headers: {
          ...appVersion.restHeaders(sessionId),
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      });
      if (response.status === 401 && attempt === 0) {
        await response.arrayBuffer().catch(() => {});
        continue;
      }
      if (!response.ok) {
        await response.arrayBuffer().catch(() => {});
        throw new MercedesError(
          `${new URL(url).pathname.split('/').slice(0, 3).join('/')}: HTTP ${response.status}`,
          {
            kind: kindOfStatus(response.status),
            status: response.status,
          },
        );
      }
      if (binary) {
        return Buffer.from(await response.arrayBuffer());
      }
      const text = await response.text();
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        throw new MercedesError('Unexpected answer of the Mercedes API', {
          kind: KINDS.UNREACHABLE,
        });
      }
    }
    throw new MercedesError('Access refused', { kind: KINDS.AUTH, status: 401 });
  }

  const rest = appVersion.profile.rest;
  return {
    sessionId,
    /**
     * @description The cars of the account (own and shared, fleets included).
     * @returns {Promise<Array<object>>} The vehicle master data.
     */
    async vehicles() {
      const data = await get(`${rest}/v2/vehicles`);
      const list = [...(data?.assignedVehicles ?? [])];
      for (const fleet of data?.fleets ?? []) {
        list.push(...(fleet.bookedVehicles ?? []));
      }
      return list;
    },
    capabilities: (vin) => get(`${rest}/v1/vehicle/${encodeURIComponent(vin)}/capabilities`),
    commandCapabilities: (vin) =>
      get(`${rest}/v1/vehicle/${encodeURIComponent(vin)}/capabilities/commands`),
    vehicleAttributes: (vin) =>
      get(`${appVersion.profile.widget}/v1/vehicle/${encodeURIComponent(vin)}/vehicleattributes`, {
        binary: true,
      }),
  };
}

export { createRest };
