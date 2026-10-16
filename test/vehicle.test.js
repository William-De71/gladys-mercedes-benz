import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decodePush, decodeVepUpdate, acknowledgementOf } from '../src/mercedes/proto.js';
import { canonical, updatesOf, applyUpdate } from '../src/attributes.js';
import { describe, summarize } from '../src/vehicle.js';
import {
  VIN_EV,
  VIN_DIESEL,
  EV_ATTRIBUTES,
  DIESEL_VSU,
  MASTER_DATA,
  EV_COMMANDS,
  vepFrame,
  vsuFrame,
  restAttributes,
  decodeClient,
} from './helpers/fixtures.js';

const read = (frame) => {
  const { type, message } = decodePush(frame);
  return updatesOf(type, message);
};

test('both message shapes use one canonical key', () => {
  assert.equal(canonical('door_status_overall'), 'doorstatusoverall');
  assert.equal(canonical('doorStatusOverall'), 'doorstatusoverall');
  assert.equal(canonical('tirepressure_front_left'), 'tirepressurefrontleft');
  assert.equal(canonical('tirepressureFrontLeft'), 'tirepressurefrontleft');
  assert.equal(canonical('charge_coupler_a_c_status'), canonical('chargeCouplerACStatus'));
});

test('a VEP full update of an electric car', () => {
  const [update] = read(vepFrame({ [VIN_EV]: EV_ATTRIBUTES }));
  assert.equal(update.vin, VIN_EV);
  assert.equal(update.full, true);
  const s = summarize(update.attributes);
  assert.deepEqual(s.battery, { level: 78, rangeKm: 312 });
  assert.equal(s.fuel.level, null, 'no fuel, never 0');
  assert.equal(s.odometerKm, 23456);
  assert.equal(s.lock, 'locked');
  assert.deepEqual(s.openings, {
    doors: false,
    trunk: false,
    hood: null,
    windows: false,
    sunroof: false,
  });
  assert.equal(s.charge.status, 'unplugged');
  assert.equal(s.charge.plugged, false);
  assert.equal(s.charge.targetLevel, 80);
  assert.equal(s.climate, false);
  assert.equal(s.engineRunning, false);
  assert.deepEqual(s.location, { latitude: 48.8584, longitude: 2.2945, heading: 90 });
  assert.deepEqual(s.tires, { frontLeft: 2.5, frontRight: 2.52, rearLeft: 2.48, rearRight: 2.5 });
  assert.deepEqual(s.alarm, { armed: true, active: false });
  assert.deepEqual(s.service, { days: 120, distanceKm: 14500 });
  assert.deepEqual(s.warnings, []);
});

test('a VSU update of a diesel in miles: proto3 defaults, unavailable values', () => {
  const [update] = read(vsuFrame({ [VIN_DIESEL]: DIESEL_VSU }));
  assert.equal(update.vin, VIN_DIESEL);
  const s = summarize(update.attributes);
  assert.equal(s.battery.level, null);
  assert.equal(s.fuel.level, 64);
  assert.equal(s.fuel.rangeKm, 644, '400 mi');
  assert.equal(s.odometerKm, 80467, '50,000 mi');
  assert.equal(s.lock, 'unlocked');
  // Present with metadata only: the default value, closed.
  assert.equal(s.openings.trunk, false);
  // Status "not available": unknown.
  assert.equal(s.openings.sunroof, null);
  assert.equal(s.engineRunning, true);
  assert.equal(s.climate, false, 'auxiliary heater off');
  assert.deepEqual(s.warnings, ['washer_fluid']);
});

test('a partial update changes only what it carries', () => {
  const [full] = read(vepFrame({ [VIN_EV]: EV_ATTRIBUTES }));
  let attributes = applyUpdate(undefined, full);
  const [partial] = read(
    vepFrame(
      {
        [VIN_EV]: { doorlockstatusvehicle: { int_value: 0 }, decklidstatus: { bool_value: true } },
      },
      { full: false, sequence: 2 },
    ),
  );
  assert.equal(partial.full, false);
  attributes = applyUpdate(attributes, partial);
  const s = summarize(attributes);
  assert.equal(s.lock, 'unlocked', 'an int_value of 0 is a value');
  assert.equal(s.openings.trunk, true);
  assert.deepEqual(s.openList, ['trunk']);
  assert.equal(s.battery.level, 78, 'kept');
});

test('charge: plugged from the inlets, charging, end time', () => {
  const [update] = read(
    vsuFrame({
      [VIN_EV]: {
        fin_or_vin: VIN_EV,
        full_update: true,
        soc: { value: 40 },
        chargingstatus: { value: 0 },
        chargingactive: { value: true },
        charging_power: { value: 11.04 },
        endofchargetime: { value: 1350 },
        charge_inlets: { value: [{ id: 1, coupler_state: 2 }] },
      },
    }),
  );
  const s = summarize(update.attributes);
  assert.deepEqual(s.charge, {
    active: true,
    status: 'charging',
    plugged: true,
    powerKw: 11,
    targetLevel: null,
    endTime: '22:30',
  });
});

test('warnings: 12 V battery, tires, fluids', () => {
  const [update] = read(
    vepFrame({
      [VIN_EV]: {
        starterBatteryState: { int_value: 2 },
        tirewarninglamp: { int_value: 1 },
        warningbrakefluid: { bool_value: true },
        warningcoolantlevellow: { bool_value: true },
      },
    }),
  );
  assert.deepEqual(summarize(update.attributes).warnings, [
    'low_battery',
    'tire_pressure',
    'brake_fluid',
    'coolant',
  ]);
});

test('values with an invalid status are unknown', () => {
  const [update] = read(vepFrame({ [VIN_EV]: { soc: { int_value: 55, status: 3 } } }));
  assert.equal(summarize(update.attributes).battery.level, null);
});

test('the REST fallback body reads like a VEP update', () => {
  const vep = decodeVepUpdate(restAttributes(VIN_EV, EV_ATTRIBUTES));
  const [update] = updatesOf('rest', vep);
  assert.equal(update.vin, VIN_EV);
  assert.equal(summarize(update.attributes).battery.level, 78);
});

test('every update is acknowledged with its sequence number', () => {
  const { type, message } = decodePush(vepFrame({ [VIN_EV]: EV_ATTRIBUTES }, { sequence: 42 }));
  assert.deepEqual(decodeClient(acknowledgementOf(type, message)).acknowledge_vep_updates_by_vin, {
    sequence_number: 42,
  });
  const vsu = decodePush(vsuFrame({ [VIN_DIESEL]: DIESEL_VSU }, 7));
  assert.deepEqual(
    decodeClient(acknowledgementOf(vsu.type, vsu.message)).acknowledge_vehicle_status_updates,
    { sequence_number: 7 },
  );
  // The same bytes as the app (and mbapi2020).
  assert.equal(Buffer.from(acknowledgementOf('assigned_vehicles', {})).toString('hex'), 'ba0100');
  assert.equal(
    Buffer.from(acknowledgementOf('apptwin_pending_command_request', {})).toString('hex'),
    'aa0100',
  );
  assert.equal(acknowledgementOf('debugMessage', {}), null);
});

test('describe: model, plate, commands; unknown capabilities stay null', () => {
  const ev = describe(
    MASTER_DATA.assignedVehicles[0],
    { features: { precondNow: true } },
    EV_COMMANDS,
  );
  assert.equal(ev.vin, VIN_EV);
  assert.equal(ev.model, 'EQA 250');
  assert.equal(ev.licensePlate, 'AB-123-CD');
  assert.ok(ev.commands.has('DOORS_LOCK'));
  assert.deepEqual(ev.sigposTypes, ['LIGHT_ONLY', 'LIGHT_AND_HORN']);
  const diesel = describe(MASTER_DATA.assignedVehicles[1], null, null);
  assert.equal(diesel.vin, VIN_DIESEL, 'the FIN when there is no VIN');
  assert.equal(diesel.commands, null);
  assert.equal(diesel.licensePlate, null);
});
