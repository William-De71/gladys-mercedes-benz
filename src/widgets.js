// -----------------------------------------------------------------------------
// The `vehicle` dashboard widget.
//
// One card per car (setting `vehicle`, a `source: "devices"` select; empty =
// the first car of the account):
//   - up to three tiles: battery (or fuel), range, odometer;
//   - a status list: lock, openings, charge, climate, engine, position,
//     anti-theft alarm, warnings, age of the data;
//   - up to four buttons: lock/unlock, climate, flash the lights (to find it
//     in a car park), the position on a map. Unlock and flash ask first.
// The budget of the core is 8 components: 3 tiles + 1 status + 4 buttons.
// -----------------------------------------------------------------------------

import { t, warningLabel, openingsLabel, ago } from './i18n.js';
import { supports } from './commands.js';
import { mapUrl } from './geo.js';

const WIDGETS = { VEHICLE: 'vehicle' };
const WIDGET_ACTIONS = {
  LOCK: 'lock',
  UNLOCK: 'unlock',
  CLIMATE_START: 'climate_start',
  CLIMATE_STOP: 'climate_stop',
  FLASH: 'flash',
};
const TTL_SECONDS = { vehicle: 60, message: 120 };
const MAX_STATUS_LENGTH = 40;

const clip = (value, max) => {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL_SECONDS.message) {
  return { ttl_seconds: ttl, components: [{ type: 'text', variant: 'body', text: message }] };
}

/**
 * @description Format a whole number for a tile.
 * @param {number} value - The number.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function formatNumber(value, language) {
  const locales = { fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };
  return new Intl.NumberFormat(locales[language] ?? 'en-US', { maximumFractionDigits: 0 }).format(
    value,
  );
}

/**
 * @description The tiles of a car.
 * @param {object} snapshot - Its snapshot.
 * @param {string} language - The language.
 * @returns {Array<object>} The tiles (0 to 3).
 */
function tiles(snapshot, language) {
  const result = [];
  const { battery, fuel } = snapshot;
  const color = (level) => (level <= 20 ? 'danger' : level <= 40 ? 'warning' : 'success');
  if (battery.level !== null) {
    result.push({
      type: 'value',
      value: formatNumber(battery.level, language),
      unit: '%',
      label: t('battery', language),
      icon: snapshot.charge.status === 'charging' ? 'battery-charging' : 'battery',
      color: color(battery.level),
    });
  } else if (fuel.level !== null) {
    result.push({
      type: 'value',
      value: formatNumber(fuel.level, language),
      unit: '%',
      label: t('fuel', language),
      icon: 'droplet',
      color: color(fuel.level),
    });
  }
  const range = battery.rangeKm ?? fuel.rangeKm;
  if (range !== null) {
    result.push({
      type: 'value',
      value: formatNumber(range, language),
      unit: 'km',
      label: t('range', language),
      icon: 'navigation',
    });
  }
  if (snapshot.odometerKm !== null) {
    result.push({
      type: 'value',
      value: formatNumber(snapshot.odometerKm, language),
      unit: 'km',
      label: t('odometer', language),
      icon: 'activity',
    });
  }
  return result;
}

/**
 * @description The status list of a car.
 * @param {object} reading - Its reading.
 * @param {string} language - The language.
 * @param {number} now - Now, in ms.
 * @returns {Array<object>} The items.
 */
function statusItems(reading, language, now) {
  const { snapshot } = reading;
  const items = [];
  if (snapshot.lock) {
    items.push({
      label: t('lockState', language),
      value: t(snapshot.lock, language),
      color: snapshot.lock === 'locked' ? 'success' : 'warning',
    });
  }
  if (Object.values(snapshot.openings).some((state) => state !== null)) {
    items.push({
      label: t('openings', language),
      value:
        snapshot.openList.length === 0
          ? t('allClosed', language)
          : clip(
              t('open', language, { list: openingsLabel(snapshot.openList, language) }),
              MAX_STATUS_LENGTH,
            ),
      color: snapshot.openList.length === 0 ? 'success' : 'warning',
    });
  }
  if (snapshot.charge.status) {
    const { status, endTime } = snapshot.charge;
    const label = t(`charge_${status}`, language);
    items.push({
      label: t('charging', language),
      value: endTime
        ? clip(t('chargeUntil', language, { status: label, time: endTime }), MAX_STATUS_LENGTH)
        : label,
      color: status === 'charging' ? 'info' : status === 'error' ? 'danger' : 'neutral',
    });
  }
  if (snapshot.climate !== null) {
    items.push({
      label: t('climate', language),
      value: t(snapshot.climate ? 'on' : 'off', language),
      color: snapshot.climate ? 'info' : 'neutral',
    });
  }
  if (snapshot.engineRunning !== null) {
    items.push({
      label: t('engine', language),
      value: t(snapshot.engineRunning ? 'running' : 'stopped', language),
      color: snapshot.engineRunning ? 'info' : 'neutral',
    });
  }
  if (reading.atHome !== null && reading.atHome !== undefined) {
    items.push({
      label: t('position', language),
      value: reading.atHome
        ? t('atHome', language)
        : t('awayFrom', language, { km: formatNumber(reading.distanceHomeKm, language) }),
      color: reading.atHome ? 'success' : 'neutral',
    });
  }
  if (snapshot.alarm.armed !== null) {
    items.push({
      label: t('alarm', language),
      value: t(
        snapshot.alarm.active ? 'alarmTriggered' : snapshot.alarm.armed ? 'armed' : 'disarmed',
        language,
      ),
      color: snapshot.alarm.active ? 'danger' : snapshot.alarm.armed ? 'success' : 'neutral',
    });
  }
  items.push({
    label: t('warnings', language),
    value:
      snapshot.warnings.length === 0
        ? t('noWarning', language)
        : clip(
            snapshot.warnings.map((warning) => warningLabel(warning, language)).join(', '),
            MAX_STATUS_LENGTH,
          ),
    color: snapshot.warnings.length === 0 ? 'success' : 'danger',
  });
  const updatedAt = snapshot.updatedAt ?? reading.readAt;
  if (Number.isFinite(updatedAt)) {
    items.push({ label: t('updated', language), value: ago(updatedAt, now, language) });
  }
  return items.slice(0, 10);
}

/**
 * @description The buttons of a car.
 * @param {object} info - The car description.
 * @param {object} reading - Its reading.
 * @param {string} language - The language.
 * @param {boolean} canUnlock - Whether a PIN is set.
 * @returns {Array<object>} The buttons (0 to 4).
 */
function buttons(info, reading, language, canUnlock) {
  const { snapshot } = reading;
  const params = { vin: info.vin };
  const result = [];
  if (snapshot.lock === 'locked' && canUnlock && supports(info, 'unlock')) {
    result.push({
      type: 'button',
      label: t('buttonUnlock', language),
      icon: 'unlock',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.UNLOCK, params, confirm: true },
    });
  } else if (snapshot.lock === 'unlocked' && supports(info, 'lock')) {
    result.push({
      type: 'button',
      label: t('buttonLock', language),
      icon: 'lock',
      style: 'primary',
      action: { key: WIDGET_ACTIONS.LOCK, params },
    });
  }
  if (snapshot.climate === true && supports(info, 'climate_stop')) {
    result.push({
      type: 'button',
      label: t('buttonClimateStop', language),
      icon: 'wind',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.CLIMATE_STOP, params },
    });
  } else if (snapshot.climate === false && supports(info, 'climate_start')) {
    result.push({
      type: 'button',
      label: t('buttonClimateStart', language),
      icon: 'wind',
      style: 'primary',
      action: { key: WIDGET_ACTIONS.CLIMATE_START, params },
    });
  }
  if (supports(info, 'flash')) {
    result.push({
      type: 'button',
      label: t('buttonFlash', language),
      icon: 'sun',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.FLASH, params, confirm: true },
    });
  }
  if (snapshot.location) {
    result.push({
      type: 'button',
      label: t('buttonMap', language),
      icon: 'map-pin',
      style: 'secondary',
      link: { url: mapUrl(snapshot.location) },
    });
  }
  return result;
}

/**
 * @description The `vehicle` widget.
 * @param {object} options - Options.
 * @param {object} options.info - The car description.
 * @param {object|null} options.reading - Its last reading.
 * @param {object} [options.settings] - `{ show_buttons }`.
 * @param {boolean} [options.canUnlock] - Whether a PIN is set.
 * @param {string} options.language - The language.
 * @param {number} options.now - Now, in ms.
 * @returns {object} The content.
 * @example
 * buildVehicleWidget({ info, reading, settings, language: 'fr', now: Date.now() });
 */
function buildVehicleWidget({ info, reading, settings = {}, canUnlock = false, language, now }) {
  if (!reading) {
    return messageContent(t('loading', language), 30);
  }
  const components = [...tiles(reading.snapshot, language)];
  components.push({ type: 'status', items: statusItems(reading, language, now) });
  if (settings.show_buttons !== false) {
    components.push(...buttons(info, reading, language, canUnlock));
  }
  return { ttl_seconds: TTL_SECONDS.vehicle, components };
}

export { WIDGETS, WIDGET_ACTIONS, messageContent, buildVehicleWidget };
