// -----------------------------------------------------------------------------
// Remote commands: what Gladys can ask the car, and the CommandRequest that
// carries it over the websocket.
//
// A command is offered when the car lists it as available in its command
// capabilities; when those could not be read (some cars answer 401, often in
// North America), it is tried and the car answers.
//
// Unlock needs the security PIN of the Mercedes me app (setting `pin`).
// Engine start, windows opening and sunroof, which also need it, are left
// out on purpose: from a home automation box, the risk outweighs the use.
// -----------------------------------------------------------------------------

const COMMANDS = {
  lock: { capability: 'DOORS_LOCK' },
  unlock: { capability: 'DOORS_UNLOCK', pin: true },
  climate_start: { capability: ['ZEV_PRECONDITIONING_START', 'AUXHEAT_START'] },
  climate_stop: { capability: ['ZEV_PRECONDITIONING_STOP', 'AUXHEAT_STOP'] },
  flash: { capability: 'SIGPOS_START' },
  horn: { capability: 'SIGPOS_START' },
  windows_close: { capability: 'WINDOWS_CLOSE' },
  charge_limit: {
    capability: ['CHARGING_CONFIGURE', 'CHARGE_PROGRAM_CONFIGURE', 'BATTERY_MAX_SOC_CONFIGURE'],
  },
};
const COMMAND_KEYS = Object.keys(COMMANDS);
// Scene action and widget commands (the charge limit is a device feature).
const SCENE_COMMANDS = COMMAND_KEYS.filter((key) => key !== 'charge_limit');

const CHARGE_LIMITS = [50, 60, 70, 80, 90, 100];

// SigPosStart: type, and the horn / light parameters the app sends for it.
const SIGPOS = {
  LIGHT_ONLY: { sigpos_type: 0, horn_repeat: 0, horn_type: 0, light_type: 1 },
  HORN_ONLY: { sigpos_type: 1, horn_repeat: 1, horn_type: 1, light_type: 0 },
  LIGHT_AND_HORN: { sigpos_type: 2, horn_repeat: 1, horn_type: 1, light_type: 2 },
};

/**
 * @description Whether a car accepts one of the capability names.
 * @param {object} info - The car description (vehicle.js describe).
 * @param {string|string[]} names - The capability names.
 * @returns {boolean} True when available, or when the capabilities are unknown.
 */
function hasCapability(info, names) {
  if (info.commands === null || info.commands === undefined) {
    return true;
  }
  return [].concat(names).some((name) => info.commands.has(name));
}

/**
 * @description Whether a car accepts a command.
 * @param {object} info - The car description.
 * @param {string} command - A COMMANDS key.
 * @returns {boolean} True when it does.
 * @example
 * supports(info, 'lock');
 */
function supports(info, command) {
  const definition = COMMANDS[command];
  if (!definition) {
    return false;
  }
  if (command === 'horn') {
    return hasCapability(info, 'SIGPOS_START') && hornType(info) !== null;
  }
  return hasCapability(info, definition.capability);
}

/**
 * @description The horn mode of a car: light and horn, else horn only.
 * @param {object} info - The car description.
 * @returns {string|null} A SIGPOS key, or null when the car has no horn mode.
 */
function hornType(info) {
  const allowed = info.sigposTypes ?? [];
  if (allowed.length === 0) {
    return 'LIGHT_AND_HORN';
  }
  return ['LIGHT_AND_HORN', 'HORN_ONLY'].find((type) => allowed.includes(type)) ?? null;
}

/**
 * @description The CommandRequest content of a command.
 * @param {object} info - The car description.
 * @param {string} command - A COMMANDS key.
 * @param {object} [options] - Options.
 * @param {string} [options.pin] - The security PIN (unlock).
 * @param {number} [options.level] - The charge limit, in % (charge_limit).
 * @param {number} [options.chargeProgram] - The selected charge program.
 * @returns {{ field: string, payload: object }} The oneof field and its content.
 * @throws {Error} With `code` 'pin_required' or 'unsupported'.
 * @example
 * buildCommand(info, 'lock'); // -> { field: 'doors_lock', payload: { doors: [] } }
 */
function buildCommand(info, command, { pin = '', level = null, chargeProgram = 0 } = {}) {
  const fail = (code) => Object.assign(new Error(code), { code });
  if (!supports(info, command)) {
    throw fail('unsupported');
  }
  const has = (name) => hasCapability(info, name) && info.commands !== null;
  switch (command) {
    case 'lock':
      return { field: 'doors_lock', payload: { doors: [] } };
    case 'unlock':
      if (!String(pin ?? '').trim()) {
        throw fail('pin_required');
      }
      return { field: 'doors_unlock', payload: { pin: String(pin).trim() } };
    case 'climate_start':
      if (has('AUXHEAT_START') && !has('ZEV_PRECONDITIONING_START')) {
        return { field: 'auxheat_start', payload: {} };
      }
      // "now" for the cars that report precondNow, "immediate" otherwise.
      return {
        field: 'zev_preconditioning_start',
        payload: { departure_time: 0, type: info.features?.precondNow ? 3 : 1 },
      };
    case 'climate_stop':
      if (has('AUXHEAT_STOP') && !has('ZEV_PRECONDITIONING_STOP')) {
        return { field: 'auxheat_stop', payload: {} };
      }
      return { field: 'zev_preconditioning_stop', payload: { type: 3 } };
    case 'flash':
      return { field: 'sigpos_start', payload: { ...SIGPOS.LIGHT_ONLY, sigpos_duration: 8 } };
    case 'horn':
      return { field: 'sigpos_start', payload: { ...SIGPOS[hornType(info)], sigpos_duration: 8 } };
    case 'windows_close':
      return { field: 'windows_close', payload: {} };
    case 'charge_limit': {
      const value = CHARGE_LIMITS.reduce((best, step) =>
        Math.abs(step - Number(level)) < Math.abs(best - Number(level)) ? step : best,
      );
      if (has('CHARGING_CONFIGURE') || info.commands === null) {
        return { field: 'charging_configure', payload: { max_soc: { value } } };
      }
      return {
        field: 'charge_program_configure',
        payload: { charge_program: Number(chargeProgram) || 0, max_soc: { value } },
      };
    }
    default:
      throw fail('unsupported');
  }
}

export { COMMANDS, COMMAND_KEYS, SCENE_COMMANDS, CHARGE_LIMITS, supports, hornType, buildCommand };
