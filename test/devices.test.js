// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): every feature needs min / max /
// read_only / has_feedback, a wrong category / type pair shows no icon nor
// label, a unit outside DEVICE_FEATURE_UNITS_BY_CATEGORY is refused. Plus the
// pure logic of the scene events and the widget.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
  validateWidgetContent,
} from '@gladysassistant/integration-sdk';

import { FEATURES, buildDevice, buildStates, parseExternalId, vehicleName } from '../src/device.js';
import {
  detectEvents,
  buildSceneEvent,
  buildAccountProblemEvent,
  SCENE_TRIGGERS,
} from '../src/events.js';
import { buildVehicleWidget } from '../src/widgets.js';
import { transportOf } from '../src/transport.js';
import { describe, summarize } from '../src/vehicle.js';
import { updatesOf } from '../src/attributes.js';
import { decodePush } from '../src/mercedes/proto.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  VIN_EV,
  EV_ATTRIBUTES,
  MASTER_DATA,
  EV_COMMANDS,
  NOW,
  vepFrame,
  fakeGladys,
} from './helpers/fixtures.js';

const INFO = describe(
  MASTER_DATA.assignedVehicles[0],
  { features: { precondNow: true } },
  EV_COMMANDS,
);
const snapshotOf = (attributes) => {
  const { type, message } = decodePush(vepFrame({ [VIN_EV]: attributes }));
  return summarize(updatesOf(type, message)[0].attributes);
};
const SNAPSHOT = snapshotOf(EV_ATTRIBUTES);

// Pairs with a label in the Gladys front (front/src/config/i18n, v5.2.1), and
// the units DEVICE_FEATURE_UNITS_BY_CATEGORY of the core accepts for them.
const PAIRS = {
  [`${C.ELECTRICAL_VEHICLE_BATTERY}/${T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_LEVEL}`]: [U.PERCENT],
  [`${C.ELECTRICAL_VEHICLE_BATTERY}/${T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_RANGE_ESTIMATE}`]: [
    U.KM,
  ],
  [`${C.LEVEL_SENSOR}/${T.LEVEL_SENSOR.LIQUID_LEVEL_PERCENT}`]: [U.PERCENT],
  [`${C.DISTANCE_SENSOR}/${T.SENSOR.DECIMAL}`]: [U.KM],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.ODOMETER}`]: [U.KM],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.DOOR_OPENED}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.WINDOW_OPENED}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.TIRE_PRESSURE}`]: [U.BAR],
  [`${C.ELECTRICAL_VEHICLE_COMMAND}/${T.ELECTRICAL_VEHICLE_COMMAND.LOCK}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_COMMAND}/${T.ELECTRICAL_VEHICLE_COMMAND.ALARM}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_CHARGE}/${T.ELECTRICAL_VEHICLE_CHARGE.PLUGGED}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_CHARGE}/${T.ELECTRICAL_VEHICLE_CHARGE.CHARGE_ON}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_CHARGE}/${T.ELECTRICAL_VEHICLE_CHARGE.CHARGE_POWER}`]: [U.KILOWATT],
  [`${C.ELECTRICAL_VEHICLE_CHARGE}/${T.ELECTRICAL_VEHICLE_CHARGE.TARGET_CHARGE_LIMIT}`]: [
    U.PERCENT,
  ],
  [`${C.ELECTRICAL_VEHICLE_CLIMATE}/${T.ELECTRICAL_VEHICLE_CLIMATE.CLIMATE_ON}`]: [undefined],
  [`${C.DURATION}/${T.DURATION.INTEGER}`]: [U.DAYS],
  [`${C.TEXT}/${T.TEXT.TEXT}`]: [undefined],
};

test('every feature: a known pair, an accepted unit, the four mandatory fields', () => {
  const device = buildDevice(fakeGladys, INFO, SNAPSHOT, { language: 'en', distanceHomeKm: 1.2 });
  assert.equal(device.features.length, FEATURES.length - 3, 'no fuel level, fuel range, hood');
  for (const feature of device.features) {
    const units = PAIRS[`${feature.category}/${feature.type}`];
    assert.ok(units, `${feature.external_id}: ${feature.category}/${feature.type}`);
    assert.ok(units.includes(feature.unit), `${feature.external_id}: ${feature.unit}`);
    for (const field of ['min', 'max', 'read_only', 'has_feedback']) {
      assert.notEqual(feature[field], undefined, `${feature.external_id} ${field}`);
    }
    assert.ok(feature.min <= feature.max, feature.external_id);
  }
  assert.equal(device.should_poll, false);
  assert.equal(device.poll_frequency, undefined);
});

test('features follow what the car reports: an unknown value has no feature', () => {
  const device = buildDevice(fakeGladys, INFO, SNAPSHOT, { language: 'en', distanceHomeKm: null });
  const keys = device.features.map((feature) => feature.external_id.split(':').pop());
  for (const key of ['fuel_level', 'fuel_range', 'hood', 'distance_home']) {
    assert.ok(!keys.includes(key), key);
  }
  const empty = buildDevice(fakeGladys, INFO, summarize(), { language: 'en' });
  assert.deepEqual(
    empty.features.map((feature) => feature.external_id.split(':').pop()),
    ['warnings'],
  );
});

test('commands are writable only when the car accepts them', () => {
  const readOnly = { ...INFO, commands: new Set() };
  const device = buildDevice(fakeGladys, readOnly, SNAPSHOT, { language: 'en' });
  for (const key of ['lock', 'climate', 'charge_target']) {
    assert.equal(
      device.features.find((f) => f.external_id.endsWith(`:${key}`)).read_only,
      true,
      key,
    );
  }
  const writable = buildDevice(fakeGladys, INFO, SNAPSHOT, { language: 'en' });
  for (const key of ['lock', 'climate', 'charge_target']) {
    assert.equal(
      writable.features.find((f) => f.external_id.endsWith(`:${key}`)).read_only,
      false,
      key,
    );
  }
});

test('states: numbers and texts, unknown values left out, in every language', () => {
  for (const language of LANGUAGES) {
    const states = buildStates(fakeGladys, INFO, SNAPSHOT, { language, distanceHomeKm: null });
    for (const state of states) {
      assert.ok(
        Number.isFinite(state.state) || typeof state.text === 'string',
        state.device_feature_external_id,
      );
    }
    assert.ok(!states.some((s) => s.device_feature_external_id.endsWith(':fuel_level')));
  }
  const ids = new Set(['ext:mercedes-benz:vehicle:W1NSYNTH0EV000001:lock']);
  assert.equal(buildStates(fakeGladys, INFO, SNAPSHOT, { language: 'en' }, ids).length, 1);
});

test('names and external ids', () => {
  assert.equal(vehicleName(INFO, 'fr'), 'Mercedes-Benz EQA 250 (AB-123-CD)');
  assert.equal(
    vehicleName({ vin: VIN_EV, model: null, licensePlate: null }, 'de'),
    'Mercedes-Benz Fahrzeug (…0001)',
  );
  assert.deepEqual(parseExternalId(`ext:test:vehicle:${VIN_EV}:lock`), {
    vin: VIN_EV,
    feature: 'lock',
  });
  assert.deepEqual(parseExternalId(`ext:test:vehicle:${VIN_EV}`), { vin: VIN_EV, feature: null });
  assert.equal(parseExternalId('nothing'), null);
});

test('scene events: a baseline, then one event per transition', () => {
  const reading = (attributes, atHome = true) => ({
    snapshot: snapshotOf({ ...EV_ATTRIBUTES, ...attributes }),
    atHome,
    distanceHomeKm: atHome ? 0 : 3.21,
  });
  const base = reading({});
  assert.deepEqual(detectEvents(null, base), []);
  assert.deepEqual(detectEvents(base, reading({})), []);
  const next = reading(
    {
      doorlockstatusvehicle: { int_value: 0 },
      ignitionstate: { int_value: 4 },
      chargingstatus: { int_value: 0 },
      tirewarninglamp: { int_value: 1 },
    },
    false,
  );
  const events = detectEvents(base, next);
  assert.deepEqual(
    events.map((event) => event.key),
    [
      SCENE_TRIGGERS.LOCK_CHANGED,
      SCENE_TRIGGERS.ENGINE_CHANGED,
      SCENE_TRIGGERS.CHARGING_CHANGED,
      SCENE_TRIGGERS.CHARGER_CONNECTION_CHANGED,
      SCENE_TRIGGERS.HOME_CHANGED,
      SCENE_TRIGGERS.WARNING_RAISED,
    ],
  );
  for (const language of LANGUAGES) {
    for (const event of events) {
      const { key, data } = buildSceneEvent(event, {
        vehicle: 'ext:x:vehicle:V',
        carName: 'Mercedes-Benz EQA 250',
        reading: next,
        language,
      });
      assert.equal(key, event.key);
      assert.ok(Object.keys(data).length <= 30);
      for (const value of Object.values(data)) {
        assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
        assert.ok(typeof value !== 'string' || value.length <= 1000);
      }
      assert.ok(data.summary.length > 0);
    }
  }
  const home = buildSceneEvent(events[4], {
    vehicle: 'v',
    carName: 'C',
    reading: next,
    language: 'en',
  });
  assert.equal(home.data.distance_km, 3.2);
  // Locked with the trunk open: once, then again only when one more opens.
  const open = reading({ decklidstatus: { bool_value: true } });
  assert.deepEqual(
    detectEvents(base, open).map((e) => e.key),
    [SCENE_TRIGGERS.LEFT_OPEN],
  );
  assert.deepEqual(detectEvents(open, open), []);
  assert.equal(buildAccountProblemEvent('blocked', 'fr').data.reason, 'blocked');
});

test('the widget: valid in every language, within the budget', () => {
  const reading = { snapshot: SNAPSHOT, atHome: false, distanceHomeKm: 12.4, readAt: NOW };
  for (const language of LANGUAGES) {
    for (const canUnlock of [true, false]) {
      const content = buildVehicleWidget({ info: INFO, reading, canUnlock, language, now: NOW });
      const { errors = [] } = validateWidgetContent(content);
      assert.deepEqual(errors, [], language);
      assert.ok(content.components.length <= 8);
      const buttons = content.components.filter((c) => c.type === 'button');
      assert.ok(buttons.length <= 4);
      assert.equal(new Set(buttons.map((b) => b.action?.key ?? b.label)).size, buttons.length);
      for (const button of buttons) {
        assert.ok(button.label.length <= 24, button.label);
      }
      const status = content.components.find((c) => c.type === 'status');
      for (const item of status.items) {
        assert.ok(item.value, item.label);
      }
    }
  }
  const without = buildVehicleWidget({
    info: INFO,
    reading,
    settings: { show_buttons: false },
    language: 'en',
    now: NOW,
  });
  assert.ok(!without.components.some((c) => c.type === 'button'));
  assert.equal(
    buildVehicleWidget({ info: INFO, reading: null, language: 'en', now: NOW }).components[0].type,
    'text',
  );
});

test('transport: cloud, degraded while blocked, unreachable when refused', () => {
  assert.deepEqual(transportOf('d', 'idle'), { external_id: 'd', transport: 'cloud' });
  const blocked = transportOf('d', 'blocked');
  assert.equal(blocked.degraded, true);
  for (const language of LANGUAGES) {
    assert.ok(blocked.message[language].length <= 200);
  }
  assert.equal(transportOf('d', 'auth').transport, 'unreachable');
});
