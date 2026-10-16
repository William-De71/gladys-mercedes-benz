// The whole integration against the fake Gladys of the SDK, which checks the
// discovered devices, the states, the transports and the scene events like
// the host API does, a fake Mercedes cloud and fake websockets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent, logger } from '@gladysassistant/integration-sdk';

import { createApp } from '../src/app.js';
import { WIDGETS, WIDGET_ACTIONS } from '../src/widgets.js';
import { SCENE_TRIGGERS } from '../src/events.js';
import {
  VIN_EV,
  VIN_DIESEL,
  EV_ATTRIBUTES,
  DIESEL_VSU,
  fakeMercedes,
  fakeSockets,
  vepFrame,
  vsuFrame,
  commandStatusFrame,
  restAttributes,
  response,
  until,
} from './helpers/fixtures.js';

const CONFIG = { email: 'me@example.com', password: 'secret', region: 'europe' };
const HOME = { selector: 'home', name: 'Home', latitude: 48.8584, longitude: 2.2945 };
const EV_ID = `ext:test-integration:vehicle:${VIN_EV}`;
const DIESEL_ID = `ext:test-integration:vehicle:${VIN_DIESEL}`;

/**
 * @description The integration, connected to a fake Gladys and a fake cloud.
 * @param {object} t - The test context.
 * @param {object} [options] - `{ config, cloud }`.
 * @returns {Promise<object>} `{ gladys, app, sockets, fetchImpl }`.
 */
async function startApp(t, { config = CONFIG, cloud = {} } = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'mercedes-app-'));
  const gladys = createFakeGladys({ config: { ...config }, houses: [HOME] });
  const sockets = fakeSockets();
  const fetchImpl = fakeMercedes(cloud);
  const app = createApp(gladys, { fetchImpl, createWebSocket: sockets, dataDir });
  t.after(async () => {
    app.status().client?.socket.stop();
    await gladys.fake.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });
  await gladys.connect();
  return { gladys, app, sockets: sockets.sockets, fetchImpl };
}

/**
 * @description Open the websocket and push the full state of both cars.
 * @param {object} ctx - startApp's result.
 * @returns {Promise<object>} The socket.
 */
async function pushFullState({ gladys, sockets }) {
  await until(() => sockets.length > 0);
  const ws = sockets.at(-1);
  ws.open();
  ws.receive(vepFrame({ [VIN_EV]: EV_ATTRIBUTES }));
  ws.receive(vsuFrame({ [VIN_DIESEL]: DIESEL_VSU }));
  await until(() => gladys.fake.discoveredDevices.every((device) => device.features.length > 3));
  return ws;
}

const deviceOf = (gladys, id) => gladys.fake.discoveredDevices.find((d) => d.external_id === id);

test('signs in, offers one device per car, then completes them with the pushed state', async (t) => {
  const ctx = await startApp(t);
  const { gladys } = ctx;
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.external_id).sort(),
    [EV_ID, DIESEL_ID].sort(),
  );
  await pushFullState(ctx);
  const ev = deviceOf(gladys, EV_ID);
  assert.equal(ev.name, 'Mercedes-Benz EQA 250 (AB-123-CD)');
  assert.equal(ev.should_poll, false);
  const keys = ev.features.map((f) => f.external_id.split(':').pop());
  for (const key of [
    'battery_level',
    'battery_range',
    'lock',
    'charge_target',
    'climate',
    'tire_front_left',
    'distance_home',
  ]) {
    assert.ok(keys.includes(key), key);
  }
  assert.ok(!keys.includes('fuel_level'));
  const lock = ev.features.find((f) => f.external_id.endsWith(':lock'));
  assert.equal(lock.read_only, false, 'DOORS_LOCK is available');
  const diesel = deviceOf(gladys, DIESEL_ID);
  assert.equal(diesel.name, `Mercedes-Benz C 220 d (…${VIN_DIESEL.slice(-4)})`);
  const dieselKeys = diesel.features.map((f) => f.external_id.split(':').pop());
  assert.ok(dieselKeys.includes('fuel_level') && !dieselKeys.includes('battery_level'));
  for (const device of gladys.fake.discoveredDevices) {
    for (const feature of device.features) {
      for (const field of ['min', 'max', 'read_only', 'has_feedback']) {
        assert.notEqual(feature[field], undefined, `${feature.external_id} ${field}`);
      }
    }
  }
});

test('creating a car publishes its states and transport; changes fire scene events', async (t) => {
  const ctx = await startApp(t);
  const { gladys } = ctx;
  const ws = await pushFullState(ctx);
  assert.equal(gladys.fake.states.length, 0, 'nothing before the car exists');
  await gladys.fake.deviceCreated(deviceOf(gladys, EV_ID));
  assert.equal(gladys.fake.lastState(`${EV_ID}:battery_level`), 78);
  assert.equal(gladys.fake.lastState(`${EV_ID}:lock`), 1);
  assert.equal(gladys.fake.lastState(`${EV_ID}:tire_front_left`), 2.5);
  assert.equal(gladys.fake.lastState(`${EV_ID}:distance_home`), 0);
  assert.equal(gladys.fake.lastState(`${EV_ID}:warnings`), 'None');
  assert.deepEqual(gladys.fake.transports.at(-1), {
    device_external_id: EV_ID,
    transport: 'cloud',
  });
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the first state is a baseline');

  ws.receive(
    vepFrame(
      {
        [VIN_EV]: {
          doorlockstatusvehicle: { int_value: 2 },
          windowStatusOverall: { int_value: 0 },
          chargingstatus: { int_value: 0 },
          chargeInlets: undefined,
          theftAlarmActive: { bool_value: true },
          warningwashwater: { bool_value: true },
        },
      },
      { full: false, sequence: 5 },
    ),
  );
  await until(() => gladys.fake.sceneEvents.length >= 4);
  const keys = gladys.fake.sceneEvents.map((event) => event.key);
  assert.ok(keys.includes(SCENE_TRIGGERS.LEFT_OPEN));
  assert.ok(keys.includes(SCENE_TRIGGERS.ALARM_TRIGGERED));
  assert.ok(keys.includes(SCENE_TRIGGERS.CHARGING_CHANGED));
  assert.ok(keys.includes(SCENE_TRIGGERS.WARNING_RAISED));
  for (const { data } of gladys.fake.sceneEvents) {
    assert.ok(Object.keys(data).length <= 30);
    for (const value of Object.values(data)) {
      assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
    }
  }
  const left = gladys.fake.sceneEvents.find((event) => event.key === SCENE_TRIGGERS.LEFT_OPEN);
  assert.equal(left.data.vehicle, EV_ID);
  assert.equal(left.data.openings, 'windows');
  assert.equal(gladys.fake.lastState(`${EV_ID}:windows`), 1);
});

test('device commands run in the background over the websocket', async (t) => {
  const ctx = await startApp(t, { config: { ...CONFIG, pin: '1234' } });
  const { gladys } = ctx;
  const ws = await pushFullState(ctx);
  const device = deviceOf(gladys, EV_ID);
  const lock = device.features.find((f) => f.external_id.endsWith(':lock'));
  const ack = await gladys.fake.setValue(device, lock, 0);
  assert.equal(ack.success, true);
  await until(() => ws.sent.some((m) => m.commandRequest));
  const request = ws.sent.find((m) => m.commandRequest).commandRequest;
  assert.deepEqual(request.doors_unlock, { pin: '1234' });
  ws.receive(commandStatusFrame(VIN_EV, request.request_id, 5));

  const target = device.features.find((f) => f.external_id.endsWith(':charge_target'));
  await gladys.fake.setValue(device, target, 70);
  await until(() => ws.sent.filter((m) => m.commandRequest).length === 2);
  assert.deepEqual(ws.sent.filter((m) => m.commandRequest)[1].commandRequest.charging_configure, {
    max_soc: { value: 70 },
  });
  const odometer = device.features.find((f) => f.external_id.endsWith(':odometer'));
  assert.equal((await gladys.fake.setValue(device, odometer, 1)).success, false);
});

test('unlock without a PIN is refused with an explanation', async (t) => {
  const ctx = await startApp(t);
  const { gladys } = ctx;
  await pushFullState(ctx);
  const device = deviceOf(gladys, EV_ID);
  const lock = device.features.find((f) => f.external_id.endsWith(':lock'));
  const ack = await gladys.fake.setValue(device, lock, 0);
  assert.equal(ack.success, false);
  assert.match(ack.error, /PIN/);
  const toast = await gladys.fake.widgetAction(WIDGETS.VEHICLE, WIDGET_ACTIONS.UNLOCK, {
    vin: VIN_EV,
  });
  assert.match(toast.data.message.fr, /PIN/);
});

test('the widget: valid content in every language, buttons that send commands', async (t) => {
  const ctx = await startApp(t);
  const { gladys } = ctx;
  const ws = await pushFullState(ctx);
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const vehicle of [undefined, EV_ID, DIESEL_ID]) {
      const ack = await gladys.fake.widgetGet(WIDGETS.VEHICLE, {
        settings: vehicle ? { vehicle } : {},
        language,
      });
      assert.equal(ack.success, true);
      const { content } = ack.data;
      assert.deepEqual(validateWidgetContent(content).errors ?? [], [], `${language} ${vehicle}`);
      assert.ok(content.components.length <= 8);
      for (const component of content.components.filter((c) => c.type === 'button')) {
        assert.ok(component.label.length <= 24, component.label);
      }
    }
  }
  const toast = await gladys.fake.widgetAction(WIDGETS.VEHICLE, WIDGET_ACTIONS.FLASH, {
    vin: VIN_EV,
  });
  assert.equal(toast.success, true);
  assert.ok(toast.data.message.en.length <= 200);
  await until(() => ws.sent.some((m) => m.commandRequest?.sigpos_start));
});

test('scene actions: send a command and wait, read the status', async (t) => {
  const ctx = await startApp(t);
  const { gladys } = ctx;
  const ws = await pushFullState(ctx);
  const pending = gladys.fake.sceneAction('send_command', { vehicle: EV_ID, command: 'lock' });
  await until(() => ws.sent.some((m) => m.commandRequest));
  const request = ws.sent.find((m) => m.commandRequest).commandRequest;
  ws.receive(commandStatusFrame(VIN_EV, request.request_id, 5));
  const ack = await pending;
  assert.equal(ack.success, true);
  assert.equal(ack.data.outputs.success, true);
  assert.equal(ack.data.outputs.status, 'finished');

  const refused = await gladys.fake.sceneAction('send_command', {
    vehicle: EV_ID,
    command: 'unlock',
  });
  assert.equal(refused.data.outputs.success, false);
  assert.equal(refused.data.outputs.status, 'pin_required');

  const status = await gladys.fake.sceneAction('get_status', { vehicle: DIESEL_ID });
  assert.equal(status.success, true);
  assert.equal(status.data.outputs.locked, false);
  assert.equal(status.data.outputs.fuel_level, 64);
  assert.equal(status.data.outputs.engine_running, true);
  assert.match(status.data.outputs.summary, /C 220 d/);
});

test('configuration actions: test, diagnostic without VIN or position, sign in again', async (t) => {
  const ctx = await startApp(t);
  const { gladys } = ctx;
  await pushFullState(ctx);
  const tested = await gladys.fake.action('test_connection');
  assert.equal(tested.success, true);
  assert.match(tested.data.message.en, /EQA 250.*7 commands/);

  const lines = [];
  const original = logger.info;
  logger.info = (message) => lines.push(String(message));
  try {
    const ack = await gladys.fake.action('diagnostic');
    assert.equal(ack.success, true);
  } finally {
    logger.info = original;
  }
  const text = lines.join('\n');
  assert.match(text, /Mercedes diagnostic 1\/2/);
  assert.match(text, /doorlockstatusvehicle/);
  assert.ok(!text.includes(VIN_EV) && !text.includes(VIN_DIESEL), 'no VIN');
  assert.ok(!text.includes('48.8584') && !text.includes('AB-123-CD'), 'no position nor plate');

  const signedOut = await gladys.fake.action('sign_out');
  assert.equal(signedOut.success, true);
});

test('without an account: a clear status and widget message', async (t) => {
  const { gladys } = await startApp(t, { config: {} });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /e-mail/);
  const ack = await gladys.fake.widgetGet(WIDGETS.VEHICLE, { settings: {}, language: 'en' });
  assert.match(ack.data.content.components[0].text, /Mercedes me account/);
});

test('a 2FA account fires the account problem scene event once', async (t) => {
  const { gladys } = await startApp(t, {
    cloud: { password: { body: { result: 'GOTO_LOGIN_OTP' } } },
  });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  const events = gladys.fake.sceneEvents.filter((e) => e.key === SCENE_TRIGGERS.ACCOUNT_PROBLEM);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.reason, 'two_factor');
});

test('a blocked websocket (429) reads through REST and flags the transport', async (t) => {
  const ctx = await startApp(t, {
    cloud: {
      rest: (p) =>
        p === `/v1/vehicle/${VIN_EV}/vehicleattributes`
          ? response(200, restAttributes(VIN_EV, EV_ATTRIBUTES))
          : null,
    },
  });
  const { gladys, sockets, app } = ctx;
  await gladys.fake.deviceCreated(deviceOf(gladys, EV_ID));
  await until(() => sockets.length > 0);
  sockets[0].refuse(429);
  await until(() => app.cars.get(VIN_EV).reading?.snapshot.battery.level === 78, 3000);
  // The device grew with the REST data: offered again with its battery.
  assert.ok(deviceOf(gladys, EV_ID).features.some((f) => f.external_id.endsWith(':battery_level')));
  assert.equal(gladys.fake.transports.at(-1).degraded, true);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.ok(
    gladys.fake.sceneEvents.some(
      (e) => e.key === SCENE_TRIGGERS.ACCOUNT_PROBLEM && e.data.reason === 'blocked',
    ),
  );
});
