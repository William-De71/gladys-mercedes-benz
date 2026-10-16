# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for Mercedes-Benz cars: a Node.js
service (Node 22+, ESM, no build step) running in its own sandboxed Docker
container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).
It talks to the undocumented cloud of the Mercedes me app (CIAM sign-in of
id.mercedes-benz.com, "BFF" REST API, push websocket in protobuf), as the
[mbapi2020](https://github.com/ReneNulschDE/mbapi2020) Home Assistant
integration does (MIT, see NOTICE). Runtime dependencies: the SDK,
`protobufjs` 7 and `ws`. Transport: cloud only.

## Commands

```bash
npm install
npm test                                  # node --test, never touches the network
node --test test/app.test.js              # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

Protobuf schema (only when mbapi2020 updates its protos):

```bash
python3 -I scripts/proto/extract.py <mbapi2020>/custom_components/mbapi2020/proto /tmp/desc
node scripts/proto/build.mjs /tmp/desc src/mercedes/proto.json
```

## Architecture

```
index.js                     SDK wiring only (new GladysIntegration + createApp)
src/app.js                   every handler, registered before connect()
src/mercedes/constants.js    hosts, OAuth client, app identity per region
src/mercedes/app-version.js  version headers, App Store follow-up, user overrides
src/mercedes/auth.js         CIAM sign-in (PKCE, cookies, passkey, terms), tokens in /data/session.json
src/mercedes/http.js         fetch with timeout, cookie jar, manual redirects
src/mercedes/rest.js         cars, capabilities, REST fallback (vehicleattributes)
src/mercedes/socket.js       websocket sessions, acknowledgements, commands
src/mercedes/proto.js        protobuf encode/decode (proto.json, generated)
src/attributes.js            VEP and VSU messages -> one canonical attribute map
src/vehicle.js               car description, snapshot (metric units, null = unknown)
src/commands.js              command catalog, capabilities, CommandRequest payloads
src/device.js                one device per VIN, features, states
src/events.js                scene triggers, on transitions only
src/scene-actions.js         send_command, get_status
src/widgets.js               the `vehicle` widget
src/transport.js             cloud / unreachable / degraded badge
src/geo.js                   distance from the houses of Gladys
src/i18n.js                  runtime texts in en / fr / de / es
src/config.js                config_schema normalization
```

## Rules

- **External ids are forever**: `gladys.externalIds('vehicle', vin)`, feature
  keys (`battery_level`, `lock`…), config, action, widget, scene trigger and
  action, field, option, variable and output keys too. Per feature,
  `category`, `type`, `unit`, `min`, `max` and `step` are compared by the
  "Update" button of the Discovery screen: `test/structure.test.js` checks
  them against `test/fixtures/discovery.baseline.json` (v0.1.0). Never update
  the baseline to make a test pass without a documented migration.
- **Category / type pairs** have a label in the Gladys front and a unit the
  core accepts (`test/devices.test.js`). `distance-sensor` takes `decimal`
  (`integer` has no label).
- **Never block the account**: Mercedes blocks (429) an account whose
  websocket stays open too long in a day. Keep the short sessions of
  socket.js (close after 30 s of silence, pause of the settings); never open
  a websocket per request, never retry a refused connection without backoff.
- **App identity**: Mercedes refuses an outdated app (418). The versions live
  in `src/mercedes/constants.js`; follow mbapi2020 when Mercedes changes them.
- **protobufjs 7** for `scripts/proto/build.mjs`: version 8 names the fields
  after their `json_name` and would silently break the messages.
- **States**: `publishChangedStates` with a one-hour heartbeat, only for the
  features the user created; everything again in `onDeviceCreated`. A feature
  appears when the car reports its value: the devices are offered again when
  the feature list of a car grows.
- **Scene events** on transitions only, flat scalar data; the first full
  update is a baseline. Never in reaction to a scene action.
- **Secrets and privacy**: never log the password, the PIN or a token, never
  a full VIN (`redactVin`); the Diagnostic hides VIN, plate and position. The
  container rootfs is read-only: only `/data` is written.
- **Four languages**: manifest, `src/i18n.js`, `docs/*.md`, `README*.md`
  (`test/i18n.test.js`).
- **Widget images**: after any change to the content of the widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release
  workflow with `release-as: 1.0.0`.
- **Changelog**: never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest**: texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB; `transports: ["cloud"]`; a widget button with a form would need
  Gladys 5.2.0.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style**: Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
