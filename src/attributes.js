// -----------------------------------------------------------------------------
// The attributes of a car, whatever message brought them.
//
// Mercedes sends the state of a car in two shapes:
//   - VEP (`vepUpdates`, and the REST fallback): a map of camelCase names
//     ("doorlockstatusvehicle", "tirepressureFrontLeft") to a status holding
//     one typed value (`int_value`, `bool_value`…), a display value and unit;
//   - VSU (`vehicle_status_updates`, newer): typed snake_case fields
//     ("door_status_overall") holding `value`, `unit`, `display_value` and
//     `metadata` { status, timestamp }.
// Both become one flat map keyed by the name lowercased without underscores
// ("doorstatusoverall"), so the rest of the code reads either. The enum
// numbers are the same in both shapes.
//
// proto3 leaves out a value equal to its default: a VSU attribute present
// without `value` means 0 / false (a closed door), unless its status says the
// value is missing.
// -----------------------------------------------------------------------------

const VALID = 0;
const DISTANCE_UNITS = { 1: 'km', 2: 'mi' };
const PRESSURE_UNITS = { 1: 'kPa', 2: 'bar', 3: 'psi' };

/**
 * @description The canonical key of an attribute name.
 * @param {string} name - "tirepressureFrontLeft", "tire_pressure_front_left"…
 * @returns {string} "tirepressurefrontleft".
 * @example
 * canonical('door_status_overall'); // -> 'doorstatusoverall'
 */
function canonical(name) {
  return String(name).replace(/_/g, '').toLowerCase();
}

/**
 * @description The unit of a VEP status or a VSU attribute.
 * @param {object} raw - The attribute.
 * @returns {string|null} 'km', 'mi', 'kPa', 'bar', 'psi' or null.
 */
function unitOf(raw) {
  if (raw.distance_unit !== undefined) {
    return DISTANCE_UNITS[raw.distance_unit] ?? null;
  }
  if (raw.pressure_unit !== undefined) {
    return PRESSURE_UNITS[raw.pressure_unit] ?? null;
  }
  return null;
}

/**
 * @description Normalize one VEP attribute status.
 * @param {object} raw - The VehicleAttributeStatus.
 * @returns {object} `{ value, display, unit, ts }`.
 */
function fromVep(raw) {
  const status = raw.status ?? VALID;
  const type = raw.attribute_type;
  let value = null;
  if (status === VALID && type && type !== 'nil_value' && type !== 'unsupported_value') {
    const defaults = { int_value: 0, double_value: 0, bool_value: false, string_value: '' };
    value = raw[type] ?? (type in defaults ? defaults[type] : null);
  }
  const unit = unitOf(raw);
  return {
    value,
    display: status === VALID ? (raw.display_value ?? null) : null,
    unit,
    ts: Number(raw.timestamp_in_ms) || Number(raw.timestamp) * 1000 || null,
  };
}

/**
 * @description Normalize one VSU attribute.
 * @param {string} key - Its field name.
 * @param {object} raw - The typed attribute.
 * @returns {object} `{ value, display, unit, ts }`.
 */
function fromVsu(key, raw) {
  const status = raw.metadata?.status ?? VALID;
  let value = null;
  if (status === VALID) {
    value = raw.value ?? (Array.isArray(raw.value) ? [] : 0);
  }
  let unit = null;
  if (raw.unit !== undefined) {
    const isPressure = /pressure/.test(key);
    unit = (isPressure ? PRESSURE_UNITS : DISTANCE_UNITS)[raw.unit] ?? null;
  }
  const seconds = Number(raw.metadata?.timestamp?.seconds);
  return {
    value,
    display: status === VALID ? (raw.display_value ?? null) : null,
    unit,
    ts: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null,
  };
}

/**
 * @description The car updates of a push message (or of the REST fallback).
 * @param {string} type - `vepUpdates`, `vehicle_status_updates` or `rest`.
 * @param {object} message - The decoded message (or VEPUpdate for `rest`).
 * @returns {Array<{ vin: string, full: boolean, attributes: Map<string, object> }>} The updates.
 * @example
 * updatesOf('vepUpdates', message);
 */
function updatesOf(type, message) {
  const result = [];
  if (type === 'vepUpdates' || type === 'rest') {
    const updates =
      type === 'rest' ? { [message.vin]: message } : (message.vepUpdates?.updates ?? {});
    for (const [vin, update] of Object.entries(updates)) {
      const attributes = new Map();
      for (const [name, raw] of Object.entries(update.attributes ?? {})) {
        attributes.set(canonical(name), fromVep(raw));
      }
      result.push({ vin: update.vin || vin, full: update.full_update === true, attributes });
    }
  } else if (type === 'vehicle_status_updates') {
    const updates = message.vehicle_status_updates?.vehicle_status_updates ?? {};
    for (const [vin, update] of Object.entries(updates)) {
      const attributes = new Map();
      for (const [name, raw] of Object.entries(update)) {
        if (name === 'fin_or_vin' || name === 'full_update' || !raw || typeof raw !== 'object') {
          continue;
        }
        attributes.set(canonical(name), fromVsu(name, raw));
      }
      result.push({ vin: update.fin_or_vin || vin, full: update.full_update === true, attributes });
    }
  }
  return result.filter((update) => update.vin);
}

/**
 * @description Apply an update to the attributes of a car.
 * @param {Map<string, object>|undefined} current - Its attributes.
 * @param {{ full: boolean, attributes: Map<string, object> }} update - The update.
 * @returns {Map<string, object>} The new attributes.
 */
function applyUpdate(current, update) {
  if (update.full || !current) {
    return new Map(update.attributes);
  }
  const next = new Map(current);
  for (const [key, value] of update.attributes) {
    next.set(key, value);
  }
  return next;
}

export { canonical, fromVep, fromVsu, updatesOf, applyUpdate };
