// -----------------------------------------------------------------------------
// A car: its description (master data, capabilities) and its snapshot (the
// attributes read into plain values, in metric units).
//
// A value the car did not send is null, never 0: the device then has no such
// feature, and no state is published for it.
// -----------------------------------------------------------------------------

const KM_PER_MILE = 1.609344;
const BAR_PER = { bar: 1, kPa: 0.01, psi: 0.0689476 };

const CHARGING_STATUSES = {
  0: 'charging',
  1: 'complete',
  2: 'paused',
  3: 'unplugged',
  4: 'error',
  5: 'charging',
  6: 'charging',
  7: 'discharging',
  8: 'idle',
  9: 'charging',
  10: 'charging',
  11: 'charging',
  12: 'waiting',
  13: 'charging',
  14: 'charging',
  15: 'calibrating',
};
const CHARGE_STATUS_KEYS = [...new Set(Object.values(CHARGING_STATUSES))];

const WARNINGS = [
  'low_battery',
  'tire_pressure',
  'brake_fluid',
  'brake_lining',
  'coolant',
  'engine_light',
  'washer_fluid',
];

const OPENINGS = ['doors', 'trunk', 'hood', 'windows', 'sunroof'];

const round = (value, digits = 0) =>
  value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

/**
 * @description The description of a car.
 * @param {object} master - Its entry of /v2/vehicles.
 * @param {object|null} capabilities - /capabilities (null: unknown).
 * @param {object|null} commands - /capabilities/commands (null: unknown).
 * @returns {object} The description.
 * @example
 * describe({ fin: 'W1N…', salesRelatedInformation: { baumuster: { baumusterDescription: 'EQA 250' } } }, null, null);
 */
function describe(master, capabilities, commands) {
  const vin = String(master.vin || master.fin || '').toUpperCase();
  const model =
    master.salesRelatedInformation?.baumuster?.baumusterDescription?.trim() ||
    master.vehicleModel?.trim?.() ||
    null;
  let available = null;
  let sigposTypes = [];
  if (Array.isArray(commands?.commands)) {
    available = new Set(
      commands.commands
        .filter((command) => command.isAvailable)
        .map((command) => command.commandName),
    );
    const sigpos = commands.commands.find((command) => command.commandName === 'SIGPOS_START');
    sigposTypes =
      sigpos?.parameters?.find((parameter) => parameter.parameterName === 'SIGPOS_TYPE')
        ?.allowedEnums ?? [];
  }
  return {
    vin,
    model,
    licensePlate: master.licensePlate?.trim() || null,
    isOwner: master.isOwner ?? null,
    // null: unknown (the capabilities could not be read) -> commands tried.
    commands: available,
    sigposTypes,
    features: capabilities?.features ?? {},
  };
}

/**
 * @description A number from an attribute: the display value in its unit
 * when there is one (what the app shows), the raw value otherwise.
 * @param {object|undefined} attr - The attribute.
 * @returns {{ number: number, unit: string|null }|null} The number.
 */
function numberOf(attr) {
  if (!attr || attr.value === null || attr.value === undefined) {
    return null;
  }
  const display = attr.display === null ? NaN : Number(String(attr.display).replace(',', '.'));
  if (attr.unit && Number.isFinite(display)) {
    return { number: display, unit: attr.unit };
  }
  const number = typeof attr.value === 'boolean' ? Number(attr.value) : Number(attr.value);
  return Number.isFinite(number) ? { number, unit: null } : null;
}

/**
 * @description The snapshot of a car.
 * @param {Map<string, object>} attributes - Its attributes (attributes.js).
 * @returns {object} The snapshot.
 * @example
 * summarize(attributes).battery.level; // -> 80
 */
function summarize(attributes = new Map()) {
  const attr = (key) => attributes.get(key);
  const value = (key) => {
    const a = attr(key);
    return a && a.value !== null && a.value !== undefined ? a.value : null;
  };
  const num = (key) => {
    const v = value(key);
    if (v === null || typeof v === 'object') {
      return null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (key) => {
    const v = value(key);
    if (v === null || typeof v === 'object') {
      return null;
    }
    return Boolean(Number(v));
  };
  const km = (key) => {
    const n = numberOf(attr(key));
    if (!n) {
      return null;
    }
    return round(n.unit === 'mi' ? n.number * KM_PER_MILE : n.number);
  };
  const bar = (key) => {
    const n = numberOf(attr(key));
    if (!n) {
      return null;
    }
    // Without a unit, the raw value is in kPa.
    return round(n.number * (BAR_PER[n.unit ?? 'kPa'] ?? 0.01), 2);
  };

  // Lock: 1 internal, 2 external locked; 0 unlocked, 3 selective unlocked.
  const lockCode = num('doorlockstatusvehicle');
  const lock = lockCode === null ? null : [1, 2].includes(lockCode) ? 'locked' : 'unlocked';

  // Doors: the overall status (0 any open, 1 all closed, 3 unknown), else each door.
  const doorKeys = [
    'doorstatusfrontleft',
    'doorstatusfrontright',
    'doorstatusrearleft',
    'doorstatusrearright',
  ];
  let doors = null;
  const doorOverall = num('doorstatusoverall');
  if (doorOverall === 0 || doorOverall === 1) {
    doors = doorOverall === 0;
  } else if (doorKeys.some((key) => bool(key) !== null)) {
    doors = doorKeys.some((key) => bool(key) === true);
  }
  // Windows: overall 1 closed, 0/2/3 open (airing included); else each
  // window, 2 = completely closed.
  const windowKeys = [
    'windowstatusfrontleft',
    'windowstatusfrontright',
    'windowstatusrearleft',
    'windowstatusrearright',
  ];
  let windows = null;
  const windowOverall = num('windowstatusoverall');
  if (windowOverall !== null && [0, 1, 2, 3].includes(windowOverall)) {
    windows = windowOverall !== 1;
  } else if (windowKeys.some((key) => num(key) !== null)) {
    windows = windowKeys.some((key) => num(key) !== null && num(key) !== 2);
  }
  const sunroofCode = num('sunroofstatus');
  const openings = {
    doors,
    trunk: bool('decklidstatus'),
    hood: bool('enginehoodstatus'),
    windows,
    sunroof: sunroofCode === null ? null : sunroofCode !== 0,
  };
  const openList = OPENINGS.filter((name) => openings[name] === true);

  // Charge.
  const statusCode = num('chargingstatus');
  const status = statusCode === null ? null : (CHARGING_STATUSES[statusCode] ?? null);
  let plugged = null;
  const inlets = value('chargeinlets');
  const inlet = Array.isArray(inlets) ? inlets[0] : inlets?.entries?.[0];
  if (inlet && [1, 2, 3].includes(Number(inlet.coupler_state))) {
    plugged = Number(inlet.coupler_state) !== 3;
  } else if ([0, 1, 2].includes(num('chargecoupleracstatus'))) {
    plugged = num('chargecoupleracstatus') !== 2;
  } else if (status !== null && status !== 'error' && status !== 'idle') {
    plugged = status !== 'unplugged';
  }
  const endMinutes = num('endofchargetime');
  const charge = {
    active: bool('chargingactive'),
    status,
    plugged,
    powerKw: round(num('chargingpower'), 1),
    targetLevel: num('maxsoc'),
    endTime:
      endMinutes === null || endMinutes < 0 || endMinutes >= 1440 || status !== 'charging'
        ? null
        : `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`,
  };

  // Climate: pre-conditioning of an electrified car, or the auxiliary heater.
  const climateValues = [
    bool('precondactive'),
    num('precondnow') === null ? null : num('precondnow') === 1,
    bool('auxheatactive'),
  ].filter((v) => v !== null);
  const climate = climateValues.length === 0 ? null : climateValues.some(Boolean);

  const ignition = num('ignitionstate');
  const latitude = num('positionlat');
  const longitude = num('positionlong');
  const location =
    latitude !== null && longitude !== null && !(latitude === 0 && longitude === 0)
      ? { latitude, longitude, heading: num('positionheading') }
      : null;

  const starter = num('starterbatterystate');
  const warnings = [];
  if (bool('warninglowbattery') === true || [2, 3].includes(starter)) {
    warnings.push('low_battery');
  }
  if ((num('tirewarninglamp') ?? 0) > 0) {
    warnings.push('tire_pressure');
  }
  if (bool('warningbrakefluid') === true) {
    warnings.push('brake_fluid');
  }
  if (bool('warningbrakeliningwear') === true) {
    warnings.push('brake_lining');
  }
  if (bool('warningcoolantlevellow') === true) {
    warnings.push('coolant');
  }
  if (bool('warningenginelight') === true) {
    warnings.push('engine_light');
  }
  if (bool('warningwashwater') === true) {
    warnings.push('washer_fluid');
  }

  let updatedAt = null;
  for (const a of attributes.values()) {
    if (Number.isFinite(a.ts) && (updatedAt === null || a.ts > updatedAt)) {
      updatedAt = a.ts;
    }
  }

  const soc = num('soc');
  return {
    battery: { level: soc, rangeKm: km('rangeelectric') },
    fuel: { level: num('tanklevelpercent'), rangeKm: km('rangeliquid') },
    odometerKm: km('odo'),
    lock,
    openings,
    openList,
    charge,
    climate,
    engineRunning: ignition === null ? null : ignition === 4 || ignition === 5,
    location,
    tires: {
      frontLeft: bar('tirepressurefrontleft'),
      frontRight: bar('tirepressurefrontright'),
      rearLeft: bar('tirepressurerearleft'),
      rearRight: bar('tirepressurerearright'),
    },
    alarm: { armed: bool('theftsystemarmed'), active: bool('theftalarmactive') },
    service: { days: num('serviceintervaldays'), distanceKm: km('serviceintervaldistance') },
    warnings: WARNINGS.filter((warning) => warnings.includes(warning)),
    updatedAt,
  };
}

/**
 * @description Whether the car is electrified (battery level reported).
 * @param {object} snapshot - The snapshot.
 * @returns {boolean} True for an electric or plug-in hybrid car.
 */
function isElectrified(snapshot) {
  return snapshot.battery.level !== null || snapshot.battery.rangeKm !== null;
}

export {
  CHARGING_STATUSES,
  CHARGE_STATUS_KEYS,
  WARNINGS,
  OPENINGS,
  describe,
  summarize,
  isElectrified,
};
