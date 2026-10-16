// Non-regression of the structure users depend on (see test/helpers/structure.js).
//
// test/fixtures/discovery.baseline.json was recorded at v0.1.0. Additions
// are allowed (a new feature, a new setting, a new option); a removal or a
// change of an eternal field fails here. Never update the baseline to make
// this test pass without a documented migration.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { discoveryStructure, manifestKeys } from './helpers/structure.js';

const baseline = JSON.parse(
  readFileSync(new URL('./fixtures/discovery.baseline.json', import.meta.url), 'utf8'),
);

test('every car keeps its device and feature structure', () => {
  const current = discoveryStructure();
  for (const [car, before] of Object.entries(baseline.discovery)) {
    const now = current[car];
    assert.ok(now, `${car}: still offered`);
    assert.equal(now.external_id, before.external_id);
    assert.equal(now.should_poll, before.should_poll);
    assert.equal(now.poll_frequency, before.poll_frequency);
    const byId = new Map(now.features.map((feature) => [feature.external_id, feature]));
    for (const feature of before.features) {
      assert.deepEqual(byId.get(feature.external_id), feature, feature.external_id);
    }
  }
});

test('the manifest keeps every stored key', () => {
  const now = manifestKeys();
  const before = baseline.manifest;
  for (const list of ['config_schema', 'actions']) {
    for (const key of before[list]) {
      assert.ok(now[list].includes(key), `${list}.${key} kept`);
    }
  }
  for (const widget of before.widgets) {
    const current = now.widgets.find((w) => w.key === widget.key);
    assert.ok(current, `widget ${widget.key}`);
    widget.settings.forEach((key) =>
      assert.ok(current.settings.includes(key), `${widget.key}.${key}`),
    );
  }
  for (const list of ['scene_triggers', 'scene_actions']) {
    for (const item of before[list]) {
      const current = now[list].find((entry) => entry.key === item.key);
      assert.ok(current, `${list}.${item.key}`);
      for (const field of item.fields) {
        const found = current.fields.find((f) => f.key === field.key);
        assert.ok(found, `${item.key}.${field.key}`);
        field.options.forEach((option) =>
          assert.ok(found.options.includes(option), `${item.key}.${field.key}.${option}`),
        );
      }
      for (const kind of ['variables', 'outputs']) {
        item[kind].forEach((key) => assert.ok(current[kind].includes(key), `${item.key}.${key}`));
      }
    }
  }
});
