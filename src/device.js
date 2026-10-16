// -----------------------------------------------------------------------------
// The "Mercedes-Benz <model>" devices.
//
// One device per car of the account, offered on the Discovery screen. A
// feature appears when the car reports its value (a diesel has fuel and no
// battery, a car without a sunroof no sunroof): scan again after a first
// drive if one is missing. The lock, the climate and the charge limit are
// commands when the car accepts them.
//
// The categories are the "electrical vehicle" ones of Gladys (the only car
// categories), used for every engine. Fuel and service distances use the
// generic sensors with the `decimal` type: `distance-sensor` + `integer` has
// no icon nor label in the Gladys UI.
//
// External ids: ext:<selector>:vehicle:<VIN>[:<feature>].
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { t, warningLabel } from './i18n.js';
import { supports, CHARGE_LIMITS } from './commands.js';

const DEVICE_TYPE = 'vehicle';
const BINARY = { min: 0, max: 1 };
const TEXT = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  keep_history: false,
  min: 0,
  max: 0,
};

const FEATURE_KEYS = {
  BATTERY_LEVEL: 'battery_level',
  BATTERY_RANGE: 'battery_range',
  FUEL_LEVEL: 'fuel_level',
  FUEL_RANGE: 'fuel_range',
  ODOMETER: 'odometer',
  LOCK: 'lock',
  ALARM: 'alarm',
  DOORS: 'doors',
  TRUNK: 'trunk',
  HOOD: 'hood',
  WINDOWS: 'windows',
  SUNROOF: 'sunroof',
  PLUGGED: 'plugged',
  CHARGING: 'charging',
  CHARGING_STATUS: 'charging_status',
  CHARGE_POWER: 'charge_power',
  CHARGE_TARGET: 'charge_target',
  CLIMATE: 'climate',
  TIRE_FRONT_LEFT: 'tire_front_left',
  TIRE_FRONT_RIGHT: 'tire_front_right',
  TIRE_REAR_LEFT: 'tire_rear_left',
  TIRE_REAR_RIGHT: 'tire_rear_right',
  SERVICE_DAYS: 'service_days',
  SERVICE_DISTANCE: 'service_distance',
  WARNINGS: 'warnings',
  DISTANCE_HOME: 'distance_home',
};

const known = (value) => value !== null && value !== undefined;
const binary = (value) => (known(value) ? (value ? 1 : 0) : null);

const opening = (key, name, type, read) => ({
  key,
  name,
  shape: () => ({ category: CATEGORIES.ELECTRICAL_VEHICLE_STATE, type, ...BINARY }),
  has: (info, s) => known(read(s)),
  state: (s) => binary(read(s)),
});

const tire = (key, name, read) => ({
  key,
  name,
  shape: () => ({
    category: CATEGORIES.ELECTRICAL_VEHICLE_STATE,
    type: TYPES.ELECTRICAL_VEHICLE_STATE.TIRE_PRESSURE,
    unit: UNITS.BAR,
    min: 0,
    max: 10,
  }),
  has: (info, s) => known(read(s)),
  state: (s) => read(s),
});

// Every feature: its Gladys shape, whether this car has it, and its state.
// `state` returns a number, `{ text }`, or null when unknown (not published).
const FEATURES = [
  {
    key: FEATURE_KEYS.BATTERY_LEVEL,
    name: 'featureBatteryLevel',
    shape: () => ({
      category: CATEGORIES.ELECTRICAL_VEHICLE_BATTERY,
      type: TYPES.ELECTRICAL_VEHICLE_BATTERY.BATTERY_LEVEL,
      unit: UNITS.PERCENT,
      min: 0,
      max: 100,
    }),
    has: (info, s) => known(s.battery.level),
    state: (s) => s.battery.level,
  },
  {
    key: FEATURE_KEYS.BATTERY_RANGE,
    name: 'featureBatteryRange',
    shape: () => ({
      category: CATEGORIES.ELECTRICAL_VEHICLE_BATTERY,
      type: TYPES.ELECTRICAL_VEHICLE_BATTERY.BATTERY_RANGE_ESTIMATE,
      unit: UNITS.KM,
      min: 0,
      max: 1500,
    }),
    has: (info, s) => known(s.battery.rangeKm),
    state: (s) => s.battery.rangeKm,
  },
  {
    key: FEATURE_KEYS.FUEL_LEVEL,
    name: 'featureFuelLevel',
    shape: () => ({
      category: CATEGORIES.LEVEL_SENSOR,
      type: TYPES.LEVEL_SENSOR.LIQUID_LEVEL_PERCENT,
      unit: UNITS.PERCENT,
      min: 0,
      max: 100,
    }),
    has: (info, s) => known(s.fuel.level),
    state: (s) => s.fuel.level,
  },
  {
    key: FEATURE_KEYS.FUEL_RANGE,
    name: 'featureFuelRange',
    shape: () => ({
      category: CATEGORIES.DISTANCE_SENSOR,
      type: TYPES.SENSOR.DECIMAL,
      unit: UNITS.KM,
      min: 0,
      max: 3000,
    }),
    has: (info, s) => known(s.fuel.rangeKm),
    state: (s) => s.fuel.rangeKm,
  },
  {
    key: FEATURE_KEYS.ODOMETER,
    name: 'featureOdometer',
    shape: () => ({
      category: CATEGORIES.ELECTRICAL_VEHICLE_STATE,
      type: TYPES.ELECTRICAL_VEHICLE_STATE.ODOMETER,
      unit: UNITS.KM,
      min: 0,
      max: 2000000,
    }),
    has: (info, s) => known(s.odometerKm),
    state: (s) => s.odometerKm,
  },
  {
    key: FEATURE_KEYS.LOCK,
    name: 'featureLock',
    // 1 = locked, as the dashboard labels it.
    shape: (info) => ({
      category: CATEGORIES.ELECTRICAL_VEHICLE_COMMAND,
      type: TYPES.ELECTRICAL_VEHICLE_COMMAND.LOCK,
      read_only: !supports(info, 'lock'),
      has_feedback: true,
      ...BINARY,
    }),
    has: (info, s) => known(s.lock),
    state: (s) => (known(s.lock) ? binary(s.lock === 'locked') : null),
  },
  {
    key: FEATURE_KEYS.ALARM,
    name: 'featureAlarm',
    shape: () => ({
      category: CATEGORIES.ELECTRICAL_VEHICLE_COMMAND,
      type: TYPES.ELECTRICAL_VEHICLE_COMMAND.ALARM,
      ...BINARY,
    }),
    has: (info, s) => known(s.alarm.armed),
    state: (s) => binary(s.alarm.armed),
  },
  opening(
    FEATURE_KEYS.DOORS,
    'featureDoors',
    TYPES.ELECTRICAL_VEHICLE_STATE.DOOR_OPENED,
    (s) => s.openings.doors,
  ),
  opening(
    FEATURE_KEYS.TRUNK,
    'featureTrunk',
    TYPES.ELECTRICAL_VEHICLE_STATE.DOOR_OPENED,
    (s) => s.openings.trunk,
  ),
  opening(
    FEATURE_KEYS.HOOD,
    'featureHood',
    TYPES.ELECTRICAL_VEHICLE_STATE.DOOR_OPENED,
    (s) => s.openings.hood,
  ),
  opening(
    FEATURE_KEYS.WINDOWS,
    'featureWindows',
    TYPES.ELECTRICAL_VEHICLE_STATE.WINDOW_OPENED,
    (s) => s.openings.windows,
  ),
  opening(
    FEATURE_KEYS.SUNROOF,
    'featureSunroof',
    TYPES.ELECTRICAL_VEHICLE_STATE.WINDOW_OPENED,
    (s) => s.openings.sunroof,
  ),
  {
    key: FEATURE_KEYS.PLUGGED,
    name: 'featurePlugged',
    shape: () => ({
      category: CATEGORIES.ELECTRICAL_VEHICLE_CHARGE,
      type: TYPES.ELECTRICAL_VEHICLE_CHARGE.PLUGGED,
      ...BINARY,
    }),
    has: (info, s) => known(s.charge.plugged),
    state: (s) => binary(s.charge.plugged),
  },
  {
    key: FEATURE_KEYS.CHARGING,
    name: 'featureCharging',
    shape: () => ({
      category: CATEGORIES.ELECTRICAL_VEHICLE_CHARGE,
      type: TYPES.ELECTRICAL_VEHICLE_CHARGE.CHARGE_ON,
      ...BINARY,
    }),
    has: (info, s) => known(s.charge.active),
    state: (s) => binary(s.charge.active),
  },
  {
    key: FEATURE_KEYS.CHARGING_STATUS,
    name: 'featureChargingStatus',
    shape: () => TEXT,
    has: (info, s) => known(s.charge.status),
    state: (s, { language }) =>
      known(s.charge.status) ? { text: t(`charge_${s.charge.status}`, language) } : null,
  },
  {
    key: FEATURE_KEYS.CHARGE_POWER,
    name: 'featureChargePower',
    shape: () => ({
      category: CATEGORIES.ELECTRICAL_VEHICLE_CHARGE,
      type: TYPES.ELECTRICAL_VEHICLE_CHARGE.CHARGE_POWER,
      unit: UNITS.KILOWATT,
      min: 0,
      max: 400,
    }),
    has: (info, s) => known(s.charge.powerKw),
    state: (s) => s.charge.powerKw,
  },
  {
    key: FEATURE_KEYS.CHARGE_TARGET,
    name: 'featureChargeTarget',
    shape: (info) => ({
      category: CATEGORIES.ELECTRICAL_VEHICLE_CHARGE,
      type: TYPES.ELECTRICAL_VEHICLE_CHARGE.TARGET_CHARGE_LIMIT,
      unit: UNITS.PERCENT,
      min: CHARGE_LIMITS[0],
      max: CHARGE_LIMITS[CHARGE_LIMITS.length - 1],
      read_only: !supports(info, 'charge_limit'),
      has_feedback: true,
    }),
    has: (info, s) => known(s.charge.targetLevel),
    state: (s) => s.charge.targetLevel,
  },
  {
    key: FEATURE_KEYS.CLIMATE,
    name: 'featureClimate',
    shape: (info) => ({
      category: CATEGORIES.ELECTRICAL_VEHICLE_CLIMATE,
      type: TYPES.ELECTRICAL_VEHICLE_CLIMATE.CLIMATE_ON,
      read_only: !(supports(info, 'climate_start') && supports(info, 'climate_stop')),
      has_feedback: true,
      keep_history: false,
      ...BINARY,
    }),
    has: (info, s) => known(s.climate),
    state: (s) => binary(s.climate),
  },
  tire(FEATURE_KEYS.TIRE_FRONT_LEFT, 'featureTireFrontLeft', (s) => s.tires.frontLeft),
  tire(FEATURE_KEYS.TIRE_FRONT_RIGHT, 'featureTireFrontRight', (s) => s.tires.frontRight),
  tire(FEATURE_KEYS.TIRE_REAR_LEFT, 'featureTireRearLeft', (s) => s.tires.rearLeft),
  tire(FEATURE_KEYS.TIRE_REAR_RIGHT, 'featureTireRearRight', (s) => s.tires.rearRight),
  {
    key: FEATURE_KEYS.SERVICE_DAYS,
    name: 'featureServiceDays',
    shape: () => ({
      category: CATEGORIES.DURATION,
      type: TYPES.DURATION.INTEGER,
      unit: UNITS.DAYS,
      min: -3650,
      max: 3650,
    }),
    has: (info, s) => known(s.service.days),
    state: (s) => s.service.days,
  },
  {
    key: FEATURE_KEYS.SERVICE_DISTANCE,
    name: 'featureServiceDistance',
    shape: () => ({
      category: CATEGORIES.DISTANCE_SENSOR,
      type: TYPES.SENSOR.DECIMAL,
      unit: UNITS.KM,
      min: -100000,
      max: 100000,
    }),
    has: (info, s) => known(s.service.distanceKm),
    state: (s) => s.service.distanceKm,
  },
  {
    key: FEATURE_KEYS.WARNINGS,
    name: 'featureWarnings',
    shape: () => TEXT,
    has: () => true,
    state: (s, { language }) => ({
      text:
        s.warnings.length === 0
          ? t('noWarning', language)
          : s.warnings.map((warning) => warningLabel(warning, language)).join(', '),
    }),
  },
  {
    key: FEATURE_KEYS.DISTANCE_HOME,
    name: 'featureDistanceHome',
    shape: () => ({
      category: CATEGORIES.DISTANCE_SENSOR,
      type: TYPES.SENSOR.DECIMAL,
      unit: UNITS.KM,
      min: 0,
      max: 20000,
    }),
    has: (info, s, { distanceHomeKm }) => known(distanceHomeKm),
    state: (s, { distanceHomeKm }) =>
      known(distanceHomeKm) ? Math.round(distanceHomeKm * 10) / 10 : null,
  },
];

/**
 * @description The external ids of a car.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} vin - The VIN.
 * @returns {{ device: string, feature: Function }} The ids.
 * @example
 * idsOf(gladys, 'W1NKM5BB6VU000000').device; // -> 'ext:mercedes-benz:vehicle:W1NKM5BB6VU000000'
 */
function idsOf(gladys, vin) {
  return gladys.externalIds(DEVICE_TYPE, vin);
}

/**
 * @description The VIN and feature key an external id stands for.
 * @param {string} externalId - A device or feature external id.
 * @returns {{ vin: string, feature: string|null }|null} Its parts.
 * @example
 * parseExternalId('ext:mercedes-benz:vehicle:W1NKM5BB6VU000000:lock'); // -> { vin: 'W1N…', feature: 'lock' }
 */
function parseExternalId(externalId) {
  const match = /:vehicle:([A-Z0-9]{11,17})(?::([a-z_]+))?$/.exec(String(externalId ?? ''));
  return match ? { vin: match[1], feature: match[2] ?? null } : null;
}

/**
 * @description The name of a car: "Mercedes-Benz EQA 250 (AB-123-CD)".
 * @param {object} info - The car description.
 * @param {string} [language] - The language.
 * @returns {string} The name.
 */
function vehicleName(info, language = 'en') {
  const name = t('deviceName', language, { model: info.model ?? t('defaultModel', language) });
  const plate = info.licensePlate && info.licensePlate !== info.vin ? info.licensePlate : null;
  return plate ? `${name} (${plate})` : `${name} (…${info.vin.slice(-4)})`;
}

/**
 * @description Build the device of a car.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} info - The car description.
 * @param {object} snapshot - Its snapshot.
 * @param {{ language: string, distanceHomeKm: number|null }} context - The context.
 * @returns {object} The discovered device.
 * @example
 * buildDevice(gladys, info, snapshot, { language: 'fr', distanceHomeKm: null });
 */
function buildDevice(gladys, info, snapshot, context) {
  const ids = idsOf(gladys, info.vin);
  const language = context.language ?? 'en';
  return {
    name: vehicleName(info, language),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: 'MERCEDES_VIN', value: info.vin },
      { name: 'MERCEDES_MODEL', value: info.model ?? '' },
    ],
    features: FEATURES.filter((feature) => feature.has(info, snapshot, context)).map((feature) => ({
      name: t(feature.name, language),
      external_id: ids.feature(feature.key),
      read_only: true,
      has_feedback: false,
      keep_history: true,
      ...feature.shape(info),
    })),
  };
}

/**
 * @description The states of a car. Unknown values are omitted, never sent as 0.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} info - The car description.
 * @param {object} snapshot - Its snapshot.
 * @param {object} context - The context.
 * @param {Set<string>|null} [only] - Feature external ids to keep (the created ones).
 * @returns {Array<object>} The states.
 */
function buildStates(gladys, info, snapshot, context, only = null) {
  const ids = idsOf(gladys, info.vin);
  const states = [];
  for (const feature of FEATURES) {
    const externalId = ids.feature(feature.key);
    if (only && !only.has(externalId)) {
      continue;
    }
    const value = feature.state(snapshot, context);
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'object') {
      states.push({ device_feature_external_id: externalId, text: value.text });
    } else if (Number.isFinite(value)) {
      states.push({ device_feature_external_id: externalId, state: value });
    }
  }
  return states;
}

export {
  DEVICE_TYPE,
  FEATURE_KEYS,
  FEATURES,
  idsOf,
  parseExternalId,
  vehicleName,
  buildDevice,
  buildStates,
};
