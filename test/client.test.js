// The Mercedes client: commands, sign-in, websocket sessions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildCommand, supports, SCENE_COMMANDS } from '../src/commands.js';
import { describe } from '../src/vehicle.js';
import { encodeCommand } from '../src/mercedes/proto.js';
import { createAppVersion } from '../src/mercedes/app-version.js';
import { createAuth } from '../src/mercedes/auth.js';
import { createSocket } from '../src/mercedes/socket.js';
import { KINDS, redactVin } from '../src/mercedes/errors.js';
import {
  VIN_EV,
  MASTER_DATA,
  EV_COMMANDS,
  EV_ATTRIBUTES,
  fakeMercedes,
  fakeSockets,
  vepFrame,
  commandStatusFrame,
  decodeClient,
  until,
} from './helpers/fixtures.js';

const EV = describe(
  MASTER_DATA.assignedVehicles[0],
  { features: { precondNow: true } },
  EV_COMMANDS,
);
const UNKNOWN = describe(MASTER_DATA.assignedVehicles[1], null, null);

test('commands: payloads the schema encodes', () => {
  assert.deepEqual(buildCommand(EV, 'lock'), { field: 'doors_lock', payload: { doors: [] } });
  assert.deepEqual(buildCommand(EV, 'unlock', { pin: ' 1234 ' }), {
    field: 'doors_unlock',
    payload: { pin: '1234' },
  });
  assert.deepEqual(buildCommand(EV, 'climate_start').payload, { departure_time: 0, type: 3 });
  assert.equal(buildCommand(EV, 'climate_stop').field, 'zev_preconditioning_stop');
  assert.equal(buildCommand(EV, 'flash').payload.sigpos_type, 0);
  assert.equal(buildCommand(EV, 'horn').payload.sigpos_type, 2, 'light and horn, allowed');
  assert.deepEqual(buildCommand(EV, 'charge_limit', { level: 84 }), {
    field: 'charging_configure',
    payload: { max_soc: { value: 80 } },
  });
  // The schema keeps the proto field names (protobufjs 8 would rename them).
  const limit = decodeClient(
    encodeCommand(VIN_EV, 'r', 'charging_configure', { max_soc: { value: 70 } }),
  );
  assert.deepEqual(limit.commandRequest.charging_configure, { max_soc: { value: 70 } });
  const climate = buildCommand(EV, 'climate_start');
  const decodedClimate = decodeClient(encodeCommand(VIN_EV, 'r', climate.field, climate.payload));
  assert.equal(decodedClimate.commandRequest.zev_preconditioning_start.type, 3);
  for (const command of [...SCENE_COMMANDS, 'charge_limit']) {
    const { field, payload } = buildCommand(EV, command, { pin: '1234', level: 90 });
    const decoded = decodeClient(encodeCommand(VIN_EV, 'req', field, payload));
    assert.equal(decoded.commandRequest.vin, VIN_EV, command);
    assert.equal(decoded.commandRequest.command, field, command);
  }
});

test('commands: PIN and capabilities', () => {
  assert.throws(() => buildCommand(EV, 'unlock'), { code: 'pin_required' });
  const lockOnly = { ...EV, commands: new Set(['DOORS_LOCK']) };
  assert.equal(supports(lockOnly, 'lock'), true);
  assert.equal(supports(lockOnly, 'flash'), false);
  assert.throws(() => buildCommand(lockOnly, 'flash'), { code: 'unsupported' });
  // Unknown capabilities: tried, the car answers.
  assert.equal(supports(UNKNOWN, 'climate_start'), true);
  const diesel = { ...UNKNOWN, commands: new Set(['AUXHEAT_START', 'AUXHEAT_STOP']) };
  assert.equal(buildCommand(diesel, 'climate_start').field, 'auxheat_start');
  assert.equal(buildCommand(diesel, 'climate_stop').field, 'auxheat_stop');
  const lightOnly = { ...EV, sigposTypes: ['LIGHT_ONLY'] };
  assert.equal(supports(lightOnly, 'horn'), false);
  const program = { ...EV, commands: new Set(['CHARGE_PROGRAM_CONFIGURE']) };
  assert.deepEqual(buildCommand(program, 'charge_limit', { level: 60, chargeProgram: 2 }), {
    field: 'charge_program_configure',
    payload: { charge_program: 2, max_soc: { value: 60 } },
  });
});

test('a VIN never reaches the logs whole', () => {
  assert.equal(redactVin(`car ${VIN_EV} failed`), 'car W1N…0001 failed');
});

/**
 * @description A sign-in on a fake cloud, with a temporary /data.
 * @param {object} [options] - fakeMercedes options.
 * @returns {Promise<object>} `{ auth, fetchImpl, dir }`.
 */
async function signIn(options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'mercedes-'));
  const fetchImpl = fakeMercedes(options);
  const appVersion = createAppVersion({ region: 'europe', fetchImpl });
  const auth = createAuth({
    fetchImpl,
    appVersion,
    getCredentials: () => ({ email: 'me@example.com', password: 'secret' }),
    dataDir: dir,
    sleep: async () => {},
  });
  return { auth, fetchImpl, dir, appVersion };
}

test('sign-in: the CIAM steps, PKCE, cookies, then the stored session', async () => {
  const { auth, fetchImpl, dir } = await signIn();
  try {
    assert.equal(await auth.accessToken(), 'access-1');
    const paths = fetchImpl.calls.map((call) => new URL(call.url).pathname);
    assert.deepEqual(paths, [
      '/as/authorization.oauth2',
      '/ciam/auth/login',
      '/ciam/auth/ua',
      '/ciam/auth/login/user',
      '/ciam/auth/login/pass',
      '/as/AbC/resume/as/authorization.ping',
      '/as/token.oauth2',
    ]);
    const authorize = new URL(fetchImpl.calls[0].url);
    assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(authorize.searchParams.get('redirect_uri'), 'rismycar://login-callback');
    // The cookies of the first redirect reach the next pages.
    assert.match(
      fetchImpl.calls[1].init.headers.cookie,
      /CIAM\.DEVICE=.+; PF=abc; CIAM\.SESSION=xyz/,
    );
    const password = JSON.parse(fetchImpl.calls[4].init.body);
    assert.equal(password.username, 'me@example.com');
    const token = new URLSearchParams(fetchImpl.calls[6].init.body);
    assert.equal(token.get('code'), 'the-code');
    assert.ok(token.get('code_verifier').length >= 43);
    const stored = JSON.parse(await readFile(path.join(dir, 'session.json'), 'utf8'));
    assert.equal(stored.refreshToken, 'refresh-1');
    assert.equal(stored.account, 'me@example.com');
    assert.ok(!JSON.stringify(stored).includes('secret'), 'never the password');
    // Still valid: no new request.
    const before = fetchImpl.calls.length;
    assert.equal(await auth.accessToken(), 'access-1');
    assert.equal(fetchImpl.calls.length, before);
    // Forced: a refresh, not a new sign-in.
    assert.equal(await auth.accessToken({ force: true }), 'access-2');
    const refresh = fetchImpl.calls.find(
      (call, index) => index >= before && call.url.endsWith('/as/token.oauth2'),
    );
    assert.equal(new URLSearchParams(refresh.init.body).get('grant_type'), 'refresh_token');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('sign-in: declines the passkey offer', async () => {
  const { auth, fetchImpl, dir } = await signIn({ passkey: true });
  try {
    assert.equal(await auth.accessToken(), 'access-1');
    const call = fetchImpl.calls.find((c) => c.url.endsWith('/ciam/auth/disablePasskeyDemo'));
    assert.equal(JSON.parse(call.init.body).disablePasskeyDemo, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('sign-in: 2FA and a wrong password are reported by kind', async () => {
  const twoFactor = await signIn({ password: { body: { result: 'GOTO_LOGIN_OTP' } } });
  await assert.rejects(twoFactor.auth.accessToken(), { kind: KINDS.TWO_FACTOR });
  await rm(twoFactor.dir, { recursive: true, force: true });
  const wrong = await signIn({ password: { status: 400, body: { errors: 'x' } } });
  await assert.rejects(wrong.auth.accessToken(), { kind: KINDS.AUTH });
  await rm(wrong.dir, { recursive: true, force: true });
});

test('app version: follows the App Store when Mercedes asks for an update', async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/v1/config')) {
      return Response.json({
        forceUpdate: { status: 'FORCE', storeUrl: 'https://apps.apple.com/app/id1234' },
      });
    }
    return Response.json({ results: [{ version: '1.70.0' }] });
  };
  const appVersion = createAppVersion({ region: 'europe', fetchImpl });
  assert.equal(appVersion.version(), '1.68.0 (3060)');
  assert.equal(await appVersion.refresh(), true);
  assert.equal(appVersion.version(), '1.70.0');
  assert.equal(appVersion.websocketHeaders('S')['ris-application-version'], '1.70.0');
  const overridden = createAppVersion({
    region: 'north_america',
    fetchImpl,
    getOverrides: () => ({ appVersion: '3.70.0', sdkVersion: '4.11.0' }),
  });
  const headers = overridden.websocketHeaders('S');
  assert.equal(headers['User-Agent'], 'mycar-store-us v3.70.0, ios 26.3, SDK 4.11.0');
  assert.equal(headers['X-Locale'], 'en-US');
  assert.equal(
    overridden.profile.websocket,
    'wss://websocket.amap-prod.mobilesdk.mercedes-benz.com/v2/ws',
  );
});

/**
 * @description A websocket session on fake sockets.
 * @param {object} [options] - Overrides.
 * @returns {object} `{ socket, sockets, pushes, states, auth }`.
 */
function session(options = {}) {
  const sockets = fakeSockets();
  const pushes = [];
  const states = [];
  const auth = {
    tokens: 0,
    logins: 0,
    async accessToken() {
      this.tokens += 1;
      return 'access';
    },
    async login() {
      this.logins += 1;
    },
  };
  const appVersion = createAppVersion({
    region: 'europe',
    fetchImpl: async () => Response.json({ forceUpdate: { status: 'OK' } }),
  });
  const socket = createSocket({
    auth,
    appVersion,
    sessionId: 'SESSION',
    getPauseMs: () => 60000,
    onPush: (type, message) => pushes.push({ type, message }),
    onState: (change) => states.push(change.state),
    createWebSocket: sockets,
    ...options,
  });
  return { socket, sockets: sockets.sockets, pushes, states, auth };
}

test('websocket: headers, updates dispatched and acknowledged', async () => {
  const { socket, sockets, pushes, states } = session();
  socket.start();
  const started = socket.connect();
  await until(() => sockets.length === 1);
  const ws = sockets[0];
  assert.equal(ws.url, 'wss://websocket.emea-prod.mobilesdk.mercedes-benz.com/v2/ws');
  assert.equal(ws.options.headers.Authorization, 'access', 'the token, without Bearer');
  assert.equal(ws.options.headers['OUTPUT-FORMAT'], 'PROTO');
  assert.equal(ws.options.headers['APP-SESSION-ID'], 'SESSION');
  ws.open();
  await started;
  assert.deepEqual(states, ['connected']);
  ws.receive(vepFrame({ [VIN_EV]: EV_ATTRIBUTES }, { sequence: 9 }));
  assert.equal(pushes[0].type, 'vepUpdates');
  assert.deepEqual(ws.sent[0].acknowledge_vep_updates_by_vin, { sequence_number: 9 });
  socket.stop();
  assert.equal(ws.closed, true);
});

test('websocket: a command waits for its final state', async () => {
  const { socket, sockets } = session();
  socket.start();
  const started = socket.connect();
  await until(() => sockets.length === 1);
  sockets[0].open();
  await started;
  const answer = socket.sendCommand(VIN_EV, { field: 'doors_lock', payload: { doors: [] } });
  await until(() => sockets[0].sent.length === 1);
  const request = sockets[0].sent[0].commandRequest;
  assert.equal(request.vin, VIN_EV);
  assert.ok(request.doors_lock);
  sockets[0].receive(commandStatusFrame(VIN_EV, request.request_id, 3));
  sockets[0].receive(commandStatusFrame(VIN_EV, request.request_id, 5));
  assert.deepEqual(await answer, { ok: true, status: 'finished', code: null, message: null });
  const failed = socket.sendCommand(VIN_EV, { field: 'doors_lock', payload: { doors: [] } });
  await until(() => sockets[0].sent.filter((m) => m.commandRequest).length === 2);
  const second = sockets[0].sent.filter((m) => m.commandRequest)[1].commandRequest;
  sockets[0].receive(
    commandStatusFrame(VIN_EV, second.request_id, 6, [{ code: 'RIS_FORBIDDEN', message: 'no' }]),
  );
  assert.deepEqual(await failed, {
    ok: false,
    status: 'failed',
    code: 'RIS_FORBIDDEN',
    message: 'no',
  });
  socket.stop();
});

test('websocket: 429 signs in again once and waits; 418 says the app is outdated', async () => {
  const blocked = session();
  blocked.socket.start();
  const first = blocked.socket.connect().catch(() => {});
  await until(() => blocked.sockets.length === 1);
  blocked.sockets[0].refuse(429);
  await first;
  assert.deepEqual(blocked.states, ['blocked']);
  assert.equal(blocked.auth.logins, 1);
  assert.equal(blocked.socket.status().failures, 1);
  blocked.socket.stop();

  const outdated = session();
  outdated.socket.start();
  const second = outdated.socket.connect().catch(() => {});
  await until(() => outdated.sockets.length === 1);
  outdated.sockets[0].refuse(418);
  await second;
  assert.deepEqual(outdated.states, ['outdated']);
  assert.equal(outdated.socket.status().error.kind, KINDS.OUTDATED);
  outdated.socket.stop();
});
