import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { SCENE_TRIGGERS, ACCOUNT_PROBLEMS } from '../src/events.js';
import { ACTIONS } from '../src/app.js';
import { SCENE_ACTIONS } from '../src/scene-actions.js';
import { WIDGETS } from '../src/widgets.js';
import { SCENE_COMMANDS } from '../src/commands.js';
import { CHARGE_STATUS_KEYS, WARNINGS } from '../src/vehicle.js';
import {
  AUTO_LANGUAGE,
  DEFAULT_SESSION_PAUSE,
  HOME_RADIUS,
  LANGUAGES,
  REGION_VALUES,
  SESSION_PAUSES,
} from '../src/config.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'Mercedes-Benz');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-mercedes-benz:${pkg.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-mercedes-benz/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-mercedes-benz');
});

test('declares the cloud transport only: everything goes through the Mercedes servers', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  // Single channel: no local preference to honour.
  assert.doesNotMatch(source('../src/app.js'), /GLADYS_PREFER_LOCAL/);
});

test('requires Gladys 5.3.0 (catalog keywords); houses for the home radius', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.deepEqual(manifest.categories, ['vehicles']);
  assert.equal(manifest.location, true);
  for (const key of ['network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
  // No widget button with a form: those need Gladys 5.2.0.
  assert.doesNotMatch(source('../src/widgets.js'), /fields:/);
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGETS).sort(),
  );
  const app = source('../src/app.js');
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.actions.map((action) => action.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
});

test('mirrors the values of the code', () => {
  const config = byKey(manifest.config_schema);
  assert.equal(config.get('password').type, 'secret');
  assert.equal(config.get('pin').type, 'secret');
  assert.equal(config.get('email').type, 'string');
  assert.deepEqual(values(config.get('region')), REGION_VALUES);
  assert.deepEqual(values(config.get('session_pause')), SESSION_PAUSES);
  assert.equal(config.get('session_pause').default, DEFAULT_SESSION_PAUSE);
  ['min', 'max', 'default'].forEach((bound) => {
    assert.equal(config.get('home_radius')[bound], HOME_RADIUS[bound]);
  });
  const triggers = byKey(manifest.scene_triggers);
  assert.deepEqual(
    values(byKey(triggers.get('charging_changed').fields).get('status')),
    CHARGE_STATUS_KEYS,
  );
  assert.deepEqual(values(byKey(triggers.get('warning_raised').fields).get('warning')), WARNINGS);
  assert.deepEqual(
    values(byKey(triggers.get('account_problem').fields).get('reason')),
    ACCOUNT_PROBLEMS,
  );
  const command = byKey(byKey(manifest.scene_actions).get('send_command').fields).get('command');
  assert.deepEqual(values(command), SCENE_COMMANDS);
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20);
  assert.ok(manifest.scene_actions.length <= 20);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
  }
  for (const action of manifest.scene_actions) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120);
    assert.ok((action.outputs ?? []).length <= 20, action.key);
  }
  // The scene action outlives the 90 s wait for the car's answer.
  assert.ok(byKey(manifest.scene_actions).get('send_command').timeout_seconds > 90);
  for (const widget of manifest.widgets) {
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('offers the languages of the code, automatic by default', () => {
  const field = byKey(manifest.config_schema).get('language');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
});

test('catalog of Gladys 5.3.0: search keywords within the store bounds, countries', () => {
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  for (const keyword of normalized) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword);
  }
  assert.equal(new Set(normalized).size, normalized.length, 'unique once trimmed and lowercased');
  assert.ok(!normalized.includes(manifest.name.toLowerCase()), 'never the name itself');
  assert.equal(manifest.countries, undefined, 'worldwide: no countries');
});
