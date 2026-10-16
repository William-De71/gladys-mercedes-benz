// -----------------------------------------------------------------------------
// Scene triggers: what changed between two snapshots of a car.
//
// Mercedes pushes each change; the integration compares the new snapshot with
// the previous one. The first snapshot after a start is a baseline (a car
// unlocked since this morning does not fire "unlocked" at every restart). A
// value that becomes unknown fires nothing: only a change between two known
// values does.
//
// Every car event carries the device of the car in `vehicle`, the field of
// the `source: "devices"` filter of the manifest.
// -----------------------------------------------------------------------------

import { t, warningLabel, openingsLabel } from './i18n.js';

const SCENE_TRIGGERS = {
  LOCK_CHANGED: 'lock_changed',
  LEFT_OPEN: 'left_open',
  ALARM_TRIGGERED: 'alarm_triggered',
  ENGINE_CHANGED: 'engine_changed',
  CHARGING_CHANGED: 'charging_changed',
  CHARGER_CONNECTION_CHANGED: 'charger_connection_changed',
  HOME_CHANGED: 'home_changed',
  WARNING_RAISED: 'warning_raised',
  ACCOUNT_PROBLEM: 'account_problem',
};

const ACCOUNT_PROBLEMS = ['auth', 'two_factor', 'blocked', 'outdated'];

/**
 * @description The events between two readings.
 * @param {{ snapshot: object, atHome: boolean|null }|null} previous - The
 * previous reading (null: baseline).
 * @param {{ snapshot: object, atHome: boolean|null }} next - The new reading.
 * @returns {Array<{ key: string, values: object }>} The events.
 * @example
 * detectEvents(previous, next); // -> [{ key: 'lock_changed', values: { state: 'unlocked' } }]
 */
function detectEvents(previous, next) {
  if (!previous) {
    return [];
  }
  const before = previous.snapshot;
  const after = next.snapshot;
  const events = [];
  const changed = (a, b) =>
    a !== null && a !== undefined && b !== null && b !== undefined && a !== b;

  if (changed(before.lock, after.lock)) {
    events.push({ key: SCENE_TRIGGERS.LOCK_CHANGED, values: { state: after.lock } });
  }

  // Locked with something open: when it starts, or when one more opens.
  if (after.lock === 'locked' && after.openList.length > 0) {
    const wasLeftOpen = before.lock === 'locked' && before.openList.length > 0;
    const newlyOpen = after.openList.filter((name) => !before.openList.includes(name));
    if (!wasLeftOpen || newlyOpen.length > 0) {
      events.push({ key: SCENE_TRIGGERS.LEFT_OPEN, values: { openings: after.openList } });
    }
  }

  if (before.alarm.active === false && after.alarm.active === true) {
    events.push({ key: SCENE_TRIGGERS.ALARM_TRIGGERED, values: {} });
  }

  if (changed(before.engineRunning, after.engineRunning)) {
    events.push({
      key: SCENE_TRIGGERS.ENGINE_CHANGED,
      values: { state: after.engineRunning ? 'started' : 'stopped' },
    });
  }

  if (changed(before.charge.status, after.charge.status)) {
    events.push({ key: SCENE_TRIGGERS.CHARGING_CHANGED, values: { status: after.charge.status } });
  }

  if (changed(before.charge.plugged, after.charge.plugged)) {
    events.push({
      key: SCENE_TRIGGERS.CHARGER_CONNECTION_CHANGED,
      values: { state: after.charge.plugged ? 'plugged' : 'unplugged' },
    });
  }

  if (changed(previous.atHome, next.atHome)) {
    events.push({
      key: SCENE_TRIGGERS.HOME_CHANGED,
      values: { state: next.atHome ? 'arrived' : 'left' },
    });
  }

  after.warnings
    .filter((warning) => !before.warnings.includes(warning))
    .forEach((warning) => {
      events.push({ key: SCENE_TRIGGERS.WARNING_RAISED, values: { warning } });
    });

  return events;
}

/**
 * @description The scene data of a car event.
 * @param {{ key: string, values: object }} event - From detectEvents.
 * @param {object} context - `{ vehicle, carName, reading, language }`.
 * @returns {{ key: string, data: object }} The scene event.
 * @example
 * buildSceneEvent(event, { vehicle: ids.device, carName: 'Mercedes-Benz EQA 250', reading, language: 'fr' });
 */
function buildSceneEvent(event, { vehicle, carName, reading, language }) {
  const { snapshot } = reading;
  const car = carName;
  const base = { vehicle, vehicle_name: carName };
  const level = snapshot.battery.level;
  const summary = (key, values = {}) => t(key, language, { car, ...values });
  switch (event.key) {
    case SCENE_TRIGGERS.LOCK_CHANGED:
      return {
        key: event.key,
        data: {
          ...base,
          state: event.values.state,
          summary: summary(event.values.state === 'locked' ? 'summaryLocked' : 'summaryUnlocked'),
        },
      };
    case SCENE_TRIGGERS.LEFT_OPEN: {
      const list = openingsLabel(event.values.openings, language);
      return {
        key: event.key,
        data: { ...base, openings: list, summary: summary('summaryLeftOpen', { list }) },
      };
    }
    case SCENE_TRIGGERS.ALARM_TRIGGERED:
      return { key: event.key, data: { ...base, summary: summary('summaryAlarm') } };
    case SCENE_TRIGGERS.ENGINE_CHANGED:
      return {
        key: event.key,
        data: {
          ...base,
          state: event.values.state,
          summary: summary(
            event.values.state === 'started' ? 'summaryEngineStarted' : 'summaryEngineStopped',
          ),
        },
      };
    case SCENE_TRIGGERS.CHARGING_CHANGED: {
      const status = t(`charge_${event.values.status}`, language);
      return {
        key: event.key,
        data: {
          ...base,
          status: event.values.status,
          status_label: status,
          battery_level: level,
          range_km: snapshot.battery.rangeKm,
          summary: summary('summaryCharging', { status, level: level ?? '?' }),
        },
      };
    }
    case SCENE_TRIGGERS.CHARGER_CONNECTION_CHANGED:
      return {
        key: event.key,
        data: {
          ...base,
          state: event.values.state,
          battery_level: level,
          summary: summary(
            event.values.state === 'plugged' ? 'summaryPlugged' : 'summaryUnplugged',
          ),
        },
      };
    case SCENE_TRIGGERS.HOME_CHANGED:
      return {
        key: event.key,
        data: {
          ...base,
          state: event.values.state,
          distance_km:
            reading.distanceHomeKm === null || reading.distanceHomeKm === undefined
              ? null
              : Math.round(reading.distanceHomeKm * 10) / 10,
          summary: summary(event.values.state === 'arrived' ? 'summaryArrived' : 'summaryLeft'),
        },
      };
    case SCENE_TRIGGERS.WARNING_RAISED: {
      const label = warningLabel(event.values.warning, language);
      return {
        key: event.key,
        data: {
          ...base,
          warning: event.values.warning,
          warning_label: label,
          summary: summary('summaryWarning', { warning: label }),
        },
      };
    }
    default:
      throw new Error(`Unknown event ${event.key}`);
  }
}

/**
 * @description The scene data of an account problem.
 * @param {string} reason - One of ACCOUNT_PROBLEMS.
 * @param {string} language - The language.
 * @returns {{ key: string, data: object }} The scene event.
 */
function buildAccountProblemEvent(reason, language) {
  return {
    key: SCENE_TRIGGERS.ACCOUNT_PROBLEM,
    data: { reason, summary: t(`problem_${reason}`, language) },
  };
}

export {
  SCENE_TRIGGERS,
  ACCOUNT_PROBLEMS,
  detectEvents,
  buildSceneEvent,
  buildAccountProblemEvent,
};
