// -----------------------------------------------------------------------------
// The Mercedes-Benz integration, wired to a Gladys client.
//
// `createApp(gladys)` registers every handler on the client it receives:
// `new GladysIntegration()` in production (index.js), the fake Gladys of the
// SDK in the tests. Nothing here connects: the caller does, once the handlers
// are registered.
//
// Flow: sign in (auth.js) -> list the cars and their capabilities (rest.js)
// -> open the push websocket in short sessions (socket.js) -> each update is
// read into a snapshot (attributes.js, vehicle.js), compared with the previous
// one for the scene triggers (events.js) and published as states (device.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger } from '@gladysassistant/integration-sdk';
import {
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  hasAccount,
  normalizeConfig,
  readLanguage,
} from './config.js';
import { createAppVersion } from './mercedes/app-version.js';
import { createAuth } from './mercedes/auth.js';
import { createRest } from './mercedes/rest.js';
import { createSocket } from './mercedes/socket.js';
import { decodeVepUpdate } from './mercedes/proto.js';
import { KINDS, MercedesError, redactVin } from './mercedes/errors.js';
import { applyUpdate, updatesOf } from './attributes.js';
import { describe, summarize } from './vehicle.js';
import {
  FEATURE_KEYS,
  FEATURES,
  buildDevice,
  buildStates,
  idsOf,
  parseExternalId,
  vehicleName,
} from './device.js';
import { buildCommand, supports, SCENE_COMMANDS } from './commands.js';
import {
  buildAccountProblemEvent,
  buildSceneEvent,
  detectEvents,
  SCENE_TRIGGERS,
} from './events.js';
import { SCENE_ACTIONS, buildStatusOutputs } from './scene-actions.js';
import { WIDGETS, buildVehicleWidget, messageContent } from './widgets.js';
import { transportOf } from './transport.js';
import { isHome, nearestHouse } from './geo.js';
import { all, each, t } from './i18n.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const ACTIONS = {
  TEST_CONNECTION: 'test_connection',
  REFRESH: 'refresh',
  DIAGNOSTIC: 'diagnostic',
  SIGN_OUT: 'sign_out',
};
// An unchanged state is published again every hour, so the dashboard never
// shows it as outdated while the car sleeps in the garage.
const HEARTBEAT_MS = 60 * 60 * 1000;
const HOUSES_MAX_AGE_MS = 60 * 60 * 1000;
const START_RETRY_MS = 5 * 60 * 1000;
// While Mercedes refuses the websocket (429), the REST fallback reads each
// car this often.
const FALLBACK_INTERVAL_MS = 10 * 60 * 1000;
const DIAGNOSTIC_CHUNK = 3000;
// Never written to the logs by the diagnostic.
const PRIVATE_ATTRIBUTES = /^(position|vin|fin|licenseplate|geofence)/;

/**
 * @description The anonymized diagnostic of a car: model, commands and the
 * attributes it reports, without VIN, plate or position.
 * @param {object} car - `{ info, attributes }`.
 * @returns {object} The diagnostic.
 */
function diagnosticOf(car) {
  const attributes = {};
  for (const [key, attr] of car.attributes ?? []) {
    if (PRIVATE_ATTRIBUTES.test(key)) {
      attributes[key] = '(hidden)';
      continue;
    }
    attributes[key] = {
      value: attr.value,
      ...(attr.display !== null ? { display: attr.display } : {}),
      ...(attr.unit ? { unit: attr.unit } : {}),
    };
  }
  return {
    model: car.info.model,
    owner: car.info.isOwner,
    commands: car.info.commands === null ? 'unknown' : [...car.info.commands].sort(),
    sigposTypes: car.info.sigposTypes,
    attributes,
  };
}

/**
 * @description Register the handlers of the integration on a Gladys client.
 * @param {object} gladys - The GladysIntegration instance (or the fake one).
 * @param {object} [options] - Options, for the tests.
 * @param {Function} [options.fetchImpl] - fetch.
 * @param {Function} [options.createWebSocket] - `(url, options) => ws`.
 * @param {string} [options.dataDir] - Where the session is stored.
 * @returns {object} What the tests look into.
 */
export function createApp(
  gladys,
  { fetchImpl = fetch, createWebSocket = undefined, dataDir = '/data' } = {},
) {
  let config = normalizeConfig();
  let lastLanguage = 'en';
  let createdDevices = new Set();
  let createdFeatures = new Set();
  let houses = [];
  let housesReadAt = 0;
  let lastStatus = null;
  let startRetry = null;
  let fallbackTimer = null;
  let starting = Promise.resolve();
  let client = null;
  let accountState = 'stopped';
  // vin -> { info, attributes, reading }
  const cars = new Map();
  // vin -> signature of the published feature list
  const offered = new Map();
  const transports = new Map();

  const textLanguage = () => (config.language === AUTO_LANGUAGE ? lastLanguage : config.language);

  /**
   * @description Remember the language of a widget request.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === lastLanguage) {
      return;
    }
    lastLanguage = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description The problem reason of an error, for the status and the scene.
   * @param {Error} err - The error.
   * @returns {string|null} auth, two_factor, blocked, outdated or null.
   */
  function problemOf(err) {
    switch (err?.kind) {
      case KINDS.AUTH:
        return 'auth';
      case KINDS.TWO_FACTOR:
        return 'two_factor';
      case KINDS.BLOCKED:
        return 'blocked';
      case KINDS.OUTDATED:
        return 'outdated';
      default:
        return null;
    }
  }

  /**
   * @description Report an error of the account (status, and the scene
   * trigger when it is a problem the user must know about).
   * @param {Error} err - The error.
   * @returns {Promise<void>}
   */
  async function reportError(err) {
    const reason = problemOf(err);
    const message = reason ? all(`problem_${reason}`) : all('statusUnreachable');
    const before = lastStatus;
    await reportStatus(false, message);
    if (reason && before !== lastStatus) {
      const { key, data } = buildAccountProblemEvent(reason, textLanguage());
      await gladys
        .publishSceneEvent(key, data)
        .catch((e) => logger.warn(`Unable to publish the scene event ${key}: ${e.message}`));
    }
  }

  /**
   * @description Refresh the houses of Gladys (the home of the cars).
   * @param {boolean} [force] - Even if read recently.
   * @returns {Promise<void>}
   */
  async function refreshHouses(force = false) {
    if (!force && Date.now() - housesReadAt < HOUSES_MAX_AGE_MS) {
      return;
    }
    try {
      houses = await gladys.getHouses();
      housesReadAt = Date.now();
    } catch (err) {
      logger.warn(`Unable to read the houses: ${err.message}`);
    }
  }

  /**
   * @description Refresh the external ids of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
      createdFeatures = new Set(
        devices.flatMap((device) => (device.features ?? []).map((feature) => feature.external_id)),
      );
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  const contextOf = (reading) => ({
    language: textLanguage(),
    distanceHomeKm: reading?.distanceHomeKm ?? null,
  });

  /**
   * @description Publish the states of a car that changed (or are an hour old).
   * @param {object} car - `{ info, reading }`.
   * @param {boolean} [force] - Every state, even unchanged.
   * @returns {Promise<boolean>} True when something was published.
   */
  async function publishStates(car, force = false) {
    if (!car.reading) {
      return false;
    }
    const states = buildStates(
      gladys,
      car.info,
      car.reading.snapshot,
      contextOf(car.reading),
      createdFeatures,
    );
    if (force) {
      gladys.forgetPublishedStates(idsOf(gladys, car.info.vin).device);
    }
    const { count } = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
    return count > 0;
  }

  /**
   * @description Publish the transport badge of every created car, when it changed.
   * @returns {Promise<void>}
   */
  async function publishTransports() {
    const entries = [];
    for (const { info } of cars.values()) {
      const externalId = idsOf(gladys, info.vin).device;
      if (!createdDevices.has(externalId)) {
        continue;
      }
      const entry = transportOf(externalId, accountState);
      const signature = JSON.stringify(entry);
      if (transports.get(externalId) !== signature) {
        transports.set(externalId, signature);
        entries.push(entry);
      }
    }
    if (entries.length > 0) {
      await gladys.publishTransports(entries).catch((err) => {
        entries.forEach((entry) => transports.delete(entry.external_id));
        logger.warn(`Unable to publish the transports: ${err.message}`);
      });
    }
  }

  /**
   * @description The device of a car.
   * @param {object} car - `{ info, reading }`.
   * @returns {object} The discovered device.
   */
  function deviceOf(car) {
    return buildDevice(
      gladys,
      car.info,
      car.reading?.snapshot ?? summarize(),
      contextOf(car.reading),
    );
  }

  /**
   * @description Offer a device per car on the Discovery screen.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices() {
    const devices = [...cars.values()].map((car) => {
      const device = deviceOf(car);
      offered.set(car.info.vin, device.features.map((feature) => feature.external_id).join(','));
      return device;
    });
    await gladys.publishDiscoveredDevices(devices);
    return devices.length;
  }

  /**
   * @description Read an update into the car: snapshot, events, states.
   * @param {{ vin: string, full: boolean, attributes: Map }} update - The update.
   * @param {object} [options] - Options.
   * @param {boolean} [options.merge] - Merge even a full update (REST fallback).
   * @returns {Promise<void>}
   */
  async function onUpdate(update, { merge = false } = {}) {
    const car = cars.get(update.vin);
    if (!car) {
      return;
    }
    car.attributes = applyUpdate(car.attributes, merge ? { ...update, full: false } : update);
    const snapshot = summarize(car.attributes);
    const nearest = nearestHouse(snapshot.location, houses);
    const distanceHomeKm = nearest ? nearest.distanceKm : null;
    const previous = car.reading;
    const reading = {
      snapshot,
      distanceHomeKm,
      atHome: isHome(distanceHomeKm, config.homeRadius, previous?.atHome ?? null),
      readAt: Date.now(),
    };
    car.reading = reading;

    const carName = vehicleName(car.info, textLanguage());
    const vehicle = idsOf(gladys, car.info.vin).device;
    const events = detectEvents(previous, reading);
    for (const event of events) {
      const { key, data } = buildSceneEvent(event, {
        vehicle,
        carName,
        reading,
        language: textLanguage(),
      });
      logger.info(`${carName}: ${key} (${data.summary})`);
      await gladys
        .publishSceneEvent(key, data)
        .catch((err) => logger.warn(`Unable to publish the scene event ${key}: ${err.message}`));
    }
    let changed = false;
    try {
      changed = await publishStates(car);
    } catch (err) {
      logger.warn(`Unable to publish the states of ${carName}: ${err.message}`);
    }
    // A new feature (first data of the car, a first charge…): offer it.
    const signature = deviceOf(car)
      .features.map((feature) => feature.external_id)
      .join(',');
    if (offered.get(car.info.vin) !== signature) {
      await publishDiscoveredDevices().catch((err) =>
        logger.warn(`Unable to publish the devices: ${err.message}`),
      );
    }
    if (changed || events.length > 0) {
      gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
    }
  }

  /**
   * @description Handle a push message of the websocket.
   * @param {string} type - Its type.
   * @param {object} message - Its content.
   */
  function onPush(type, message) {
    if (type !== 'vepUpdates' && type !== 'vehicle_status_updates') {
      return;
    }
    refreshHouses().catch(() => {});
    for (const update of updatesOf(type, message)) {
      onUpdate(update).catch((err) => logger.error(`Update not read: ${redactVin(err.message)}`));
    }
  }

  /**
   * @description Read every car through REST while the websocket is refused.
   * @returns {Promise<void>}
   */
  async function readThroughRest() {
    for (const { info } of cars.values()) {
      try {
        const bytes = await client.rest.vehicleAttributes(info.vin);
        const vep = decodeVepUpdate(bytes);
        for (const update of updatesOf('rest', { ...vep, vin: vep.vin || info.vin })) {
          await onUpdate(update, { merge: true });
        }
      } catch (err) {
        logger.warn(`REST reading of …${info.vin.slice(-4)} failed: ${err.message}`);
      }
    }
  }

  /**
   * @description Run the REST fallback while the websocket is blocked.
   * @param {boolean} on - Start or stop.
   */
  function fallback(on) {
    if (!on) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
      return;
    }
    if (fallbackTimer) {
      return;
    }
    readThroughRest().catch(() => {});
    fallbackTimer = setInterval(() => readThroughRest().catch(() => {}), FALLBACK_INTERVAL_MS);
    fallbackTimer.unref?.();
  }

  /**
   * @description The websocket changed state.
   * @param {{ state: string, error: Error|null }} change - The change.
   */
  function onSocketState({ state, error }) {
    accountState = state;
    if (state === 'connected' || state === 'idle') {
      fallback(false);
      reportStatus(true, all('statusConnected', { count: cars.size })).catch(() => {});
    } else if (state !== 'stopped') {
      fallback(state === 'blocked');
      logger.warn(`Mercedes connection: ${state}${error ? ` (${redactVin(error.message)})` : ''}`);
      reportError(error).catch(() => {});
    }
    publishTransports().catch(() => {});
  }

  /**
   * @description Build the Mercedes client for the current settings.
   * @returns {object} The client.
   */
  function buildClient() {
    const appVersion = createAppVersion({
      region: config.region,
      fetchImpl,
      getOverrides: () => ({ appVersion: config.appVersion, sdkVersion: config.sdkVersion }),
      logger,
    });
    const auth = createAuth({
      fetchImpl,
      appVersion,
      getCredentials: () => ({ email: config.email, password: config.password }),
      dataDir,
      logger,
    });
    const rest = createRest({ fetchImpl, auth, appVersion });
    const socket = createSocket({
      auth,
      appVersion,
      sessionId: rest.sessionId,
      getPauseMs: () => config.sessionPauseMinutes * 60 * 1000,
      onPush,
      onState: onSocketState,
      keepOpen: () => [...cars.values()].some((car) => car.reading?.snapshot.engineRunning),
      ...(createWebSocket ? { createWebSocket } : {}),
      logger,
    });
    return {
      appVersion,
      auth,
      rest,
      socket,
      signature: JSON.stringify([config.region, config.email]),
    };
  }

  /**
   * @description List the cars of the account with their capabilities.
   * @returns {Promise<void>}
   */
  async function discover() {
    const list = await client.rest.vehicles();
    const seen = new Set();
    for (const master of list) {
      const vin = String(master.vin || master.fin || '').toUpperCase();
      if (!vin || seen.has(vin)) {
        continue;
      }
      seen.add(vin);
      const optional = (promise) =>
        promise.catch((err) => {
          logger.info(`Capabilities of …${vin.slice(-4)} unavailable: ${err.message}`);
          return null;
        });
      const [capabilities, commands] = await Promise.all([
        optional(client.rest.capabilities(vin)),
        optional(client.rest.commandCapabilities(vin)),
      ]);
      const info = describe(master, capabilities, commands);
      const existing = cars.get(vin);
      cars.set(vin, {
        info,
        attributes: existing?.attributes ?? null,
        reading: existing?.reading ?? null,
      });
    }
    for (const vin of [...cars.keys()]) {
      if (!seen.has(vin)) {
        cars.delete(vin);
      }
    }
  }

  // --- Start ------------------------------------------------------------------------

  /**
   * @description Sign in, list the cars, offer them and open the sessions.
   * Retried every 5 minutes while Mercedes cannot be reached.
   * @returns {Promise<void>}
   */
  async function start() {
    clearTimeout(startRetry);
    fallback(false);
    client?.socket.stop();
    if (!hasAccount(config)) {
      client = null;
      cars.clear();
      await reportStatus(false, all('statusNoAccount'));
      return;
    }
    if (!client || client.signature !== JSON.stringify([config.region, config.email])) {
      client = buildClient();
      cars.clear();
    }
    try {
      await client.appVersion.refresh();
      await client.auth.accessToken();
      await discover();
      logger.info(
        `${cars.size} car(s): ${[...cars.values()].map(({ info }) => `${info.model ?? '?'} (…${info.vin.slice(-4)})`).join(', ') || 'none'}`,
      );
      await publishDiscoveredDevices();
      await reportStatus(true, all('statusConnected', { count: cars.size }));
      if (cars.size > 0) {
        client.socket.start();
      }
    } catch (err) {
      logger.error(`Unable to read the Mercedes me account: ${redactVin(err.message)}`);
      await reportError(err);
      // A refused password or a 2FA account needs the user: no retry loop.
      if ([KINDS.AUTH, KINDS.TWO_FACTOR].includes(err?.kind)) {
        return;
      }
      startRetry = setTimeout(() => {
        startIfReady().catch((e) => logger.error('Start failed', e));
      }, START_RETRY_MS);
      startRetry.unref?.();
    }
  }

  /**
   * @description Start, one at a time.
   * @returns {Promise<void>}
   */
  function startIfReady() {
    starting = starting.catch(() => {}).then(start);
    return starting;
  }

  // --- Commands ---------------------------------------------------------------------

  /**
   * @description Send a command and wait for the car's answer.
   * @param {object} car - `{ info, attributes }`.
   * @param {string} command - A commands.js key.
   * @param {object} [options] - `{ level }` for the charge limit.
   * @returns {Promise<{ ok: boolean, status: string }>} The answer.
   * @throws {Error} With `code` pin_required / unsupported, or a MercedesError.
   */
  async function runCommand(car, command, options = {}) {
    if (!client) {
      throw new MercedesError('Not signed in', { kind: KINDS.AUTH });
    }
    const program = car.attributes?.get('selectedchargeprogram')?.value ?? 0;
    const request = buildCommand(car.info, command, {
      pin: config.pin,
      chargeProgram: Number(program) || 0,
      ...options,
    });
    const result = await client.socket.sendCommand(car.info.vin, request);
    const name = vehicleName(car.info, 'en');
    if (result.ok) {
      logger.info(`${name}: ${command} done`);
    } else {
      logger.warn(
        `${name}: ${command} not carried out (${result.status}${result.code ? ` ${result.code}` : ''}${result.message ? `: ${result.message}` : ''})`,
      );
    }
    return result;
  }

  /**
   * @description Run a command in the background: the car answers far beyond
   * the few seconds a device command or a widget button may take.
   * @param {object} car - The car.
   * @param {string} command - The command.
   * @param {object} [options] - Options.
   */
  function runInBackground(car, command, options) {
    runCommand(car, command, options)
      .then(() => gladys.requestWidgetRefresh(WIDGETS.VEHICLE))
      .catch((err) => logger.error(`${command} failed: ${redactVin(err.message)}`));
  }

  /**
   * @description The car a device external id points at; empty = the first car.
   * @param {unknown} deviceExternalId - The `source: "devices"` value.
   * @returns {object|null} The car.
   */
  function resolveCar(deviceExternalId) {
    const parsed = parseExternalId(deviceExternalId);
    if (parsed) {
      return cars.get(parsed.vin) ?? null;
    }
    return cars.values().next().value ?? null;
  }

  const commandError = (err, command, language) => {
    if (err?.code === 'pin_required') {
      return t('commandPinRequired', language);
    }
    if (err?.code === 'unsupported') {
      return t('commandUnsupported', language, { command: t(`command_${command}`, language) });
    }
    return null;
  };

  gladys.onSetValue(async (device, feature, value) => {
    const parsed = parseExternalId(feature.external_id);
    const car = parsed ? cars.get(parsed.vin) : null;
    if (!car) {
      throw new Error('Unknown car: scan again');
    }
    let command;
    const options = {};
    if (parsed.feature === FEATURE_KEYS.LOCK) {
      command = Number(value) === 1 ? 'lock' : 'unlock';
    } else if (parsed.feature === FEATURE_KEYS.CLIMATE) {
      command = Number(value) === 1 ? 'climate_start' : 'climate_stop';
    } else if (parsed.feature === FEATURE_KEYS.CHARGE_TARGET) {
      command = 'charge_limit';
      options.level = Number(value);
    } else {
      throw new Error(`${parsed.feature} is read-only`);
    }
    if (command === 'unlock' && !config.pin) {
      throw new Error(t('commandPinRequired', 'en'));
    }
    if (!supports(car.info, command)) {
      throw new Error(t('commandUnsupported', 'en', { command: t(`command_${command}`, 'en') }));
    }
    runInBackground(car, command, options);
  });

  // --- Dashboard widget -------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.VEHICLE, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    if (!hasAccount(config)) {
      return messageContent(t('notReady', lang));
    }
    if (cars.size === 0) {
      return messageContent(t(client ? 'noVehicle' : 'loading', lang), 60);
    }
    const car = resolveCar(settings.vehicle);
    if (!car) {
      return messageContent(t('noVehicle', lang));
    }
    return buildVehicleWidget({
      info: car.info,
      reading: car.reading,
      settings,
      canUnlock: Boolean(config.pin),
      language: lang,
      now: Date.now(),
    });
  });

  gladys.onWidgetAction(WIDGETS.VEHICLE, async (actionKey, params) => {
    const car = typeof params?.vin === 'string' ? cars.get(params.vin) : null;
    if (!SCENE_COMMANDS.includes(actionKey) || !car) {
      throw new Error(`Unknown action ${actionKey}`);
    }
    try {
      buildCommand(car.info, actionKey, { pin: config.pin });
    } catch (err) {
      return each((lang) => commandError(err, actionKey, lang) ?? err.message);
    }
    runInBackground(car, actionKey);
    return each((lang) => t('commandSent', lang, { command: t(`command_${actionKey}`, lang) }));
  });

  // --- Scene actions ----------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.SEND_COMMAND, async (fields) => {
    const car = resolveCar(fields.vehicle);
    if (!car) {
      throw new Error('No Mercedes-Benz car: check the integration settings');
    }
    const command = String(fields.command ?? '');
    if (!SCENE_COMMANDS.includes(command)) {
      throw new Error(`Unknown command ${command}`);
    }
    const language = textLanguage();
    const label = t(`command_${command}`, language);
    let result;
    try {
      result = await runCommand(car, command);
    } catch (err) {
      const message = commandError(err, command, language);
      if (!message) {
        throw err;
      }
      return { success: false, status: err.code, summary: message };
    }
    gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
    return {
      success: result.ok,
      status: result.code ? `${result.status} (${result.code})` : result.status,
      summary: result.ok
        ? t('commandDone', language, { command: label })
        : t('commandFailed', language, { command: label, status: result.status }),
    };
  });

  gladys.onSceneAction(SCENE_ACTIONS.GET_STATUS, async (fields) => {
    const car = resolveCar(fields.vehicle);
    if (!car?.reading) {
      throw new Error('No data from this car yet');
    }
    return buildStatusOutputs({
      reading: car.reading,
      carName: vehicleName(car.info, textLanguage()),
      language: textLanguage(),
    });
  });

  // --- Configuration screen actions ---------------------------------------------------
  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    if (!hasAccount(config)) {
      return all('statusNoAccount');
    }
    try {
      if (!client) {
        client = buildClient();
      }
      await client.auth.accessToken();
      await discover();
      if (cars.size === 0) {
        return all('noVehicle');
      }
      return each((lang) => {
        const list = [...cars.values()]
          .map(({ info }) => {
            const count = info.commands === null ? '?' : info.commands.size;
            return `${vehicleName(info, lang)} (${t('commandCount', lang, { count })})`;
          })
          .join(', ');
        return t('testConnected', lang, { list });
      });
    } catch (err) {
      logger.warn(`Connection test failed: ${redactVin(err.message)}`);
      const reason = problemOf(err);
      return reason
        ? all(`problem_${reason}`)
        : each((lang) => `${t('statusUnreachable', lang)} (${redactVin(err.message)})`);
    }
  });

  gladys.onAction(ACTIONS.REFRESH, async () => {
    if (!client || cars.size === 0) {
      await startIfReady();
    } else {
      await client.socket.connect().catch((err) => {
        throw new Error(redactVin(err.message));
      });
    }
    return all('statusConnected', { count: cars.size });
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const list = [...cars.values()];
    const status = client?.socket.status();
    logger.info(
      `Mercedes diagnostic: integration ${version}, region ${config.region}, app ${client?.appVersion.version() ?? '?'} / SDK ${client?.appVersion.sdk() ?? '?'}, websocket ${status?.state ?? 'none'} (${status?.sessions ?? 0} sessions, ${status?.failures ?? 0} failures)`,
    );
    list.forEach((car, index) => {
      const json = JSON.stringify(diagnosticOf(car));
      const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
      for (let chunk = 0; chunk < count; chunk += 1) {
        logger.info(
          `Mercedes diagnostic ${index + 1}/${list.length}${count > 1 ? ` (${chunk + 1}/${count})` : ''}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
        );
      }
    });
    return all('diagnosticDone', { count: list.length });
  });

  gladys.onAction(ACTIONS.SIGN_OUT, async () => {
    if (client) {
      client.socket.stop();
      await client.auth.clear();
    }
    await startIfReady();
    return all('signedOut');
  });

  // --- Devices ------------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    if (!hasAccount(config)) {
      await gladys.publishDiscoveredDevices([]);
      return;
    }
    if (!client || cars.size === 0) {
      await startIfReady();
      return;
    }
    await discover();
    const count = await publishDiscoveredDevices();
    logger.info(`Scan: ${count} car(s) offered`);
  });

  // Gladys drops the states of a feature that does not exist yet: publish them
  // all once the car is created, and refresh the widget.
  gladys.onDeviceCreated(async (device) => {
    await refreshCreatedDevices();
    const parsed = parseExternalId(device.external_id);
    const car = parsed ? cars.get(parsed.vin) : null;
    if (car) {
      await publishStates(car, true).catch((err) =>
        logger.warn(`Unable to publish the states: ${err.message}`),
      );
      transports.delete(device.external_id);
      await publishTransports();
    }
    gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration ------------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallbackRaw] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallbackRaw) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      lastLanguage = readLanguage(raw, lastLanguage);
    } catch (err) {
      if (fallbackRaw) {
        config = normalizeConfig(fallbackRaw);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const before = JSON.stringify([config.email, config.password, config.region]);
    await loadConfig(rawConfig);
    const after = JSON.stringify([config.email, config.password, config.region]);
    logger.info(
      `Configuration updated: region ${config.region}, pause ${config.sessionPauseMinutes} min`,
    );
    if (before !== after || cars.size === 0) {
      lastStatus = null;
      await startIfReady();
    }
  });

  // --- Connection lifecycle -----------------------------------------------------------
  gladys.on('connected', async () => {
    await loadConfig();
    await refreshHouses(true);
    await refreshCreatedDevices();
    lastStatus = null;
    await startIfReady();
  });

  // --- Graceful shutdown --------------------------------------------------------------
  gladys.handleShutdown((signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    clearTimeout(startRetry);
    fallback(false);
    client?.socket.stop();
  });

  return {
    cars,
    onPush,
    start: startIfReady,
    status: () => ({ accountState, client }),
  };
}

export { ACTIONS, diagnosticOf, FEATURES, SCENE_TRIGGERS };
