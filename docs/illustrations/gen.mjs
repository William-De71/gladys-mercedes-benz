// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// Two cars of a made-up account, read from synthetic Mercedes messages (the
// test fixtures, encoded with the real protobuf schema): an EQA charging at
// home, its PIN set, and a C 220 d driven away, with low washer fluid.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildVehicleWidget } = await load('src/widgets.js');
const { describe, summarize } = await load('src/vehicle.js');
const { updatesOf } = await load('src/attributes.js');
const { decodePush } = await load('src/mercedes/proto.js');
const { LANGUAGES } = await load('src/i18n.js');
const fx = await load('test/helpers/fixtures.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Thursday 15 October 2026, 20:00 in Paris; the data is 5 minutes old.
const NOW = fx.NOW + 5 * 60 * 1000;
const snapshotOf = (frame) => {
  const { type, message } = decodePush(frame);
  return summarize(updatesOf(type, message)[0].attributes);
};

const eqa = {
  info: describe(
    fx.MASTER_DATA.assignedVehicles[0],
    { features: { precondNow: true } },
    fx.EV_COMMANDS,
  ),
  reading: {
    snapshot: snapshotOf(
      fx.vepFrame({
        [fx.VIN_EV]: {
          ...fx.EV_ATTRIBUTES,
          soc: { int_value: 64 },
          chargingstatus: { int_value: 0 },
          chargingactive: { bool_value: true },
          chargingPower: { double_value: 7.4 },
          endofchargetime: { int_value: 1370 },
        },
      }),
    ),
    atHome: true,
    distanceHomeKm: 0.01,
  },
};
const c220d = {
  info: describe(fx.MASTER_DATA.assignedVehicles[1], null, {
    commands: ['DOORS_LOCK', 'AUXHEAT_START', 'AUXHEAT_STOP', 'SIGPOS_START'].map(
      (commandName) => ({
        commandName,
        isAvailable: true,
      }),
    ),
  }),
  reading: {
    snapshot: snapshotOf(
      fx.vsuFrame({ [fx.VIN_DIESEL]: { ...fx.DIESEL_VSU, ignitionstate: { value: 1 } } }),
    ),
    atHome: false,
    distanceHomeKm: 12.6,
  },
};

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    eqa: buildVehicleWidget({ ...eqa, canUnlock: true, language, now: NOW }),
    c220d: buildVehicleWidget({ ...c220d, canUnlock: true, language, now: NOW }),
  };
}
const vehicle = manifest.widgets.find((w) => w.key === 'vehicle');
const widgets = Object.fromEntries(
  ['eqa', 'c220d'].map((card) => [card, { icon: vehicle.icon, label: vehicle.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
