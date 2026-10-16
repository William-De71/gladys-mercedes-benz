// -----------------------------------------------------------------------------
// Scene actions.
//
//   - `send_command`  lock, unlock, climate, flash the lights, horn, close the
//                     windows; waits for the car's answer (up to 90 s: a car
//                     asleep is slow to wake up) and says whether it ran;
//   - `get_status`    what a scene may want to say or test: lock, openings,
//                     battery or fuel, range, charge, position, warnings,
//                     with a sentence ready for a message. From the last
//                     state Mercedes pushed (no request is sent).
// -----------------------------------------------------------------------------

import { t, warningLabel, openingsLabel } from './i18n.js';
import { mapUrl } from './geo.js';

const SCENE_ACTIONS = { SEND_COMMAND: 'send_command', GET_STATUS: 'get_status' };

/**
 * @description The outputs of `get_status`.
 * @param {object} options - Options.
 * @param {object} options.reading - The reading `{ snapshot, atHome, distanceHomeKm }`.
 * @param {string} options.carName - The car name.
 * @param {string} options.language - The language.
 * @returns {object} The outputs.
 * @example
 * buildStatusOutputs({ reading, carName: 'Mercedes-Benz EQA 250', language: 'fr' });
 */
function buildStatusOutputs({ reading, carName, language }) {
  const { snapshot } = reading;
  const openings = openingsLabel(snapshot.openList, language);
  const known = Object.values(snapshot.openings).some((state) => state !== null);
  let energy = '';
  if (snapshot.battery.level !== null) {
    energy = t('summaryBattery', language, {
      level: Math.round(snapshot.battery.level),
      range: snapshot.battery.rangeKm ?? '?',
    });
  } else if (snapshot.fuel.level !== null) {
    energy = t('summaryFuel', language, {
      level: Math.round(snapshot.fuel.level),
      range: snapshot.fuel.rangeKm ?? '?',
    });
  }
  let openingsText = '?';
  if (known) {
    openingsText =
      snapshot.openList.length === 0
        ? t('allClosed', language).toLowerCase()
        : t('open', language, { list: openings }).toLowerCase();
  }
  return {
    vehicle_name: carName,
    locked: snapshot.lock === null ? null : snapshot.lock === 'locked',
    all_closed: known ? snapshot.openList.length === 0 : null,
    openings,
    battery_level: snapshot.battery.level,
    battery_range_km: snapshot.battery.rangeKm,
    fuel_level: snapshot.fuel.level,
    fuel_range_km: snapshot.fuel.rangeKm,
    charging_status: snapshot.charge.status,
    plugged: snapshot.charge.plugged,
    climate_on: snapshot.climate,
    engine_running: snapshot.engineRunning,
    odometer_km: snapshot.odometerKm,
    at_home: reading.atHome ?? null,
    distance_home_km:
      reading.distanceHomeKm === null || reading.distanceHomeKm === undefined
        ? null
        : Math.round(reading.distanceHomeKm * 10) / 10,
    latitude: snapshot.location?.latitude ?? null,
    longitude: snapshot.location?.longitude ?? null,
    map_url: snapshot.location ? mapUrl(snapshot.location) : null,
    warnings: snapshot.warnings.map((warning) => warningLabel(warning, language)).join(', '),
    summary: t('summaryStatus', language, {
      car: carName,
      lock: snapshot.lock ? t(snapshot.lock, language).toLowerCase() : '?',
      openings: openingsText,
      energy,
    }).trim(),
  };
}

export { SCENE_ACTIONS, buildStatusOutputs };
