// Fixtures of the tests: synthetic Mercedes messages built with the real
// protobuf schema (fabricated values, obvious fake VINs, like the offline
// tests of mbapi2020), a fake Mercedes cloud (sign-in pages, REST API) and a
// fake websocket. No test touches the network.

import { EventEmitter } from 'node:events';
import { PushMessage, ClientMessage, VEPUpdate } from '../../src/mercedes/proto.js';

export const VIN_EV = 'W1NSYNTH0EV000001';
export const VIN_DIESEL = 'W1NSYNTH0DS000002';
export const NOW = Date.parse('2026-10-15T08:00:00Z');
const TS = NOW - 5 * 60 * 1000;

export const copy = (value) => JSON.parse(JSON.stringify(value));

// VEP attributes of an electric car (an EQA): name -> VehicleAttributeStatus.
const int = (value, extra = {}) => ({ int_value: value, timestamp_in_ms: TS, ...extra });
const dbl = (value, extra = {}) => ({ double_value: value, timestamp_in_ms: TS, ...extra });
const bool = (value) => ({ bool_value: value, timestamp_in_ms: TS });
const km = (value) => int(value, { display_value: String(value), distance_unit: 1 });
const kpa = (value) => dbl(value, { display_value: String(value), pressure_unit: 1 });

export const EV_ATTRIBUTES = {
  soc: int(78),
  rangeelectric: km(312),
  odo: km(23456),
  doorlockstatusvehicle: int(2),
  doorStatusOverall: int(1),
  decklidstatus: bool(false),
  windowStatusOverall: int(1),
  sunroofstatus: int(0),
  chargingstatus: int(3),
  chargingactive: bool(false),
  chargingPower: dbl(0),
  maxSoc: int(80),
  selectedChargeProgram: int(0),
  precondActive: bool(false),
  ignitionstate: int(1),
  positionLat: dbl(48.8584),
  positionLong: dbl(2.2945),
  positionHeading: dbl(90),
  tirepressureFrontLeft: kpa(250),
  tirepressureFrontRight: kpa(252),
  tirepressureRearLeft: kpa(248),
  tirepressureRearRight: kpa(250),
  tirewarninglamp: int(0),
  theftSystemArmed: bool(true),
  theftAlarmActive: bool(false),
  serviceintervaldays: int(120),
  serviceintervaldistance: km(14500),
  warningwashwater: bool(false),
  warningbrakefluid: bool(false),
  warningcoolantlevellow: bool(false),
  warningenginelight: bool(false),
  warninglowbattery: bool(false),
};

// VSU fields of a diesel car (a C 220 d), in miles: the newer message shape.
const meta = { metadata: { timestamp: { seconds: Math.floor(TS / 1000) } } };
export const DIESEL_VSU = {
  fin_or_vin: VIN_DIESEL,
  full_update: true,
  tanklevelpercent: { value: 64, unit: 1, ...meta },
  rangeliquid: { value: 400, unit: 2, display_value: '400', ...meta },
  odo: { value: 50000, unit: 2, display_value: '50000', ...meta },
  doorlockstatusvehicle: { value: 0, ...meta },
  door_status_overall: { value: 1, ...meta },
  // proto3: a 0 is left out; the attribute is present with its metadata only.
  decklidstatus: { ...meta },
  window_status_overall: { value: 1, ...meta },
  ignitionstate: { value: 4, ...meta },
  auxheat_active: { ...meta },
  position_lat: { value: 52.52, ...meta },
  position_long: { value: 13.405, ...meta },
  warningwashwater: { value: 1, ...meta },
  // Status 4: not available on this car.
  sunroofstatus: { metadata: { status: 4 } },
};

/**
 * @description An encoded vepUpdates push message.
 * @param {object} cars - VIN -> attributes.
 * @param {object} [options] - `{ full, sequence }`.
 * @returns {Uint8Array} The frame.
 */
export function vepFrame(cars, { full = true, sequence = 1 } = {}) {
  const updates = {};
  for (const [vin, attributes] of Object.entries(cars)) {
    updates[vin] = {
      vin,
      full_update: full,
      emit_timestamp_in_ms: TS,
      attributes: copy(attributes),
    };
  }
  return PushMessage.encode(
    PushMessage.fromObject({ vepUpdates: { sequence_number: sequence, updates } }),
  ).finish();
}

/**
 * @description An encoded vehicle_status_updates push message.
 * @param {object} cars - VIN -> VehicleStatusUpdate fields.
 * @param {number} [sequence] - The sequence number.
 * @returns {Uint8Array} The frame.
 */
export function vsuFrame(cars, sequence = 2) {
  return PushMessage.encode(
    PushMessage.fromObject({
      vehicle_status_updates: { sequence_number: sequence, vehicle_status_updates: copy(cars) },
    }),
  ).finish();
}

/**
 * @description An encoded command status update.
 * @param {string} vin - The VIN.
 * @param {string} requestId - The request id.
 * @param {number} state - 5 finished, 6 failed.
 * @param {Array<object>} [errors] - The errors.
 * @returns {Uint8Array} The frame.
 */
export function commandStatusFrame(vin, requestId, state, errors = []) {
  return PushMessage.encode(
    PushMessage.fromObject({
      apptwin_command_status_updates_by_vin: {
        sequence_number: 3,
        updates_by_vin: {
          [vin]: {
            vin,
            updates_by_pid: { 1: { process_id: 1, request_id: requestId, state, errors } },
          },
        },
      },
    }),
  ).finish();
}

/**
 * @description The REST "vehicleattributes" body of a car.
 * @param {string} vin - The VIN.
 * @param {object} attributes - Its attributes.
 * @returns {Buffer} The protobuf body.
 */
export function restAttributes(vin, attributes) {
  return Buffer.from(
    VEPUpdate.encode(
      VEPUpdate.fromObject({ vin, full_update: true, attributes: copy(attributes) }),
    ).finish(),
  );
}

/**
 * @description Decode a frame the integration sent.
 * @param {Uint8Array} bytes - The frame.
 * @returns {object} The ClientMessage.
 */
export function decodeClient(bytes) {
  return ClientMessage.toObject(ClientMessage.decode(bytes), {
    oneofs: true,
    longs: Number,
    enums: Number,
  });
}

export const MASTER_DATA = {
  assignedVehicles: [
    {
      fin: VIN_EV,
      vin: VIN_EV,
      licensePlate: 'AB-123-CD',
      isOwner: true,
      salesRelatedInformation: { baumuster: { baumusterDescription: 'EQA 250' } },
    },
    {
      fin: VIN_DIESEL,
      licensePlate: '',
      isOwner: false,
      salesRelatedInformation: { baumuster: { baumusterDescription: 'C 220 d' } },
    },
  ],
  fleets: [],
};

export const EV_COMMANDS = {
  commands: [
    'DOORS_LOCK',
    'DOORS_UNLOCK',
    'ZEV_PRECONDITIONING_START',
    'ZEV_PRECONDITIONING_STOP',
    'SIGPOS_START',
    'CHARGING_CONFIGURE',
    'WINDOWS_CLOSE',
  ].map((commandName) => ({
    commandName,
    isAvailable: true,
    parameters:
      commandName === 'SIGPOS_START'
        ? [{ parameterName: 'SIGPOS_TYPE', allowedEnums: ['LIGHT_ONLY', 'LIGHT_AND_HORN'] }]
        : [],
  })),
};

/**
 * @description A fetch Response.
 * @param {number} status - The status.
 * @param {unknown} body - JSON, a Buffer or a string.
 * @param {object} [headers] - Headers.
 * @returns {Response} The response.
 */
export function response(status, body = '', headers = {}) {
  const payload = Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body);
  const init = { status, headers: new Headers() };
  for (const [name, value] of Object.entries(headers)) {
    for (const item of [].concat(value)) {
      init.headers.append(name, item);
    }
  }
  return new Response(status === 204 ? null : payload, init);
}

/**
 * @description A fake Mercedes cloud: the sign-in pages and the REST API.
 * @param {object} [options] - Options.
 * @param {object} [options.password] - Login step answers: `{ status, body }`.
 * @param {boolean} [options.passkey] - Offer a passkey first.
 * @param {Function} [options.rest] - `(path) => Response|null` overriding the REST API.
 * @returns {Function} The fetch, with `calls`.
 */
export function fakeMercedes({ password = null, passkey = false, rest = () => null } = {}) {
  const calls = [];
  let tokens = 0;
  const fn = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url: String(input), init });
    const path = url.pathname;
    if (url.host === 'id.mercedes-benz.com') {
      if (path === '/as/authorization.oauth2') {
        return response(302, '', {
          location: '/ciam/auth/login?resume=%2Fas%2FAbC%2Fresume%2Fas%2Fauthorization.ping',
          'set-cookie': ['PF=abc; Path=/; Secure', 'CIAM.SESSION=xyz; Path=/'],
        });
      }
      if (path === '/ciam/auth/login') {
        return response(200, '<html></html>');
      }
      if (path === '/ciam/auth/ua' || path === '/ciam/auth/login/user') {
        return response(200, {});
      }
      if (path === '/ciam/auth/login/pass') {
        if (password) {
          return response(password.status ?? 200, password.body ?? {});
        }
        if (passkey) {
          return response(200, { uid: '1', passkeyDemoEnabled: true });
        }
        return response(200, { result: 'RESUME2OIDCP', token: 'pre-login' });
      }
      if (path === '/ciam/auth/disablePasskeyDemo') {
        return response(200, { result: 'RESUME2OIDCP', token: 'pre-login' });
      }
      if (path === '/as/AbC/resume/as/authorization.ping') {
        return response(302, '', { location: 'rismycar://login-callback?code=the-code' });
      }
      if (path === '/as/token.oauth2') {
        tokens += 1;
        return response(200, {
          access_token: `access-${tokens}`,
          refresh_token: `refresh-${tokens}`,
          expires_in: 7199,
        });
      }
    }
    const custom = rest(path, url, init);
    if (custom) {
      return custom;
    }
    if (path === '/v1/config') {
      return response(200, { forceUpdate: { status: 'OK' } });
    }
    if (path === '/v2/vehicles') {
      return response(200, MASTER_DATA);
    }
    if (path === `/v1/vehicle/${VIN_EV}/capabilities`) {
      return response(200, { features: { precondNow: true }, vehicle: {} });
    }
    if (path === `/v1/vehicle/${VIN_EV}/capabilities/commands`) {
      return response(200, EV_COMMANDS);
    }
    if (path.startsWith(`/v1/vehicle/${VIN_DIESEL}/capabilities`)) {
      return response(401, {});
    }
    return response(404, {});
  };
  fn.calls = calls;
  return fn;
}

/**
 * @description A fake `ws` WebSocket.
 */
export class FakeWebSocket extends EventEmitter {
  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    this.readyState = 0;
    this.sent = [];
    this.closed = false;
  }

  open() {
    this.readyState = 1;
    this.emit('open');
  }

  receive(bytes) {
    this.emit('message', Buffer.from(bytes), true);
  }

  refuse(status) {
    this.emit('unexpected-response', {}, { statusCode: status, resume() {} });
  }

  send(bytes) {
    this.sent.push(decodeClient(bytes));
  }

  ping() {}

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.readyState = 3;
    this.emit('close', 1000);
  }

  terminate() {
    this.close();
  }
}

/**
 * @description A factory of fake websockets, keeping each one.
 * @returns {Function} The factory, with `sockets`.
 */
export function fakeSockets() {
  const sockets = [];
  const factory = (url, options) => {
    const socket = new FakeWebSocket(url, options);
    sockets.push(socket);
    return socket;
  };
  factory.sockets = sockets;
  return factory;
}

/**
 * @description Wait until a condition holds (a few event loop turns).
 * @param {Function} condition - The condition.
 * @param {number} [turns] - The maximum number of turns.
 * @returns {Promise<void>}
 */
export async function until(condition, turns = 200) {
  for (let i = 0; i < turns; i += 1) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('Condition not reached');
}

export const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:mercedes-benz:${type}:${id}`,
    feature: (key) => `ext:mercedes-benz:${type}:${id}:${key}`,
  }),
};
