# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.1] - 2026-10-24

### Security

- **security:** build the image on Node.js 24.22.1 or later ([81e9df1](https://github.com/William-De71/gladys-mercedes-benz/commit/81e9df1466249d488b7072d5f1ebd212805f22e4))

## [0.1.0] - 2026-10-16

### Added

- One device per car of the Mercedes me account (own and shared cars): battery level and electric range, fuel level and range, odometer, lock, anti-theft alarm, doors, trunk, hood, windows, sunroof, charging cable, charging, charging status and power, charge limit, pre-climatisation, tire pressures, service, warnings and distance from home. A feature appears when the car reports it.
- Remote commands where the car accepts them: lock and unlock (with the security PIN), pre-climatisation (or the auxiliary heater), charge limit, flash the lights, horn, close the windows.
- Scene triggers: locked or unlocked, locked but left open, anti-theft alarm, engine started or stopped, charging status changed, cable plugged or unplugged, arrived home or left, new warning, account problem.
- Scene actions: send a command and wait for the car's answer, read the status of a car.
- A dashboard widget per car: battery or fuel, range, odometer, status list and buttons.
- Cloud transport through the servers of the Mercedes me app: e-mail and password sign-in (passkey offer and updated terms handled), live updates over the push websocket in short sessions that keep the account from being blocked, slower REST reading while Mercedes blocks the websocket, app version followed from the App Store or set in the Advanced settings.
- A Diagnostic button that writes what each car reports to the logs, without VIN, plate nor position.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.1.1]: https://github.com/William-De71/gladys-mercedes-benz/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/William-De71/gladys-mercedes-benz/releases/tag/v0.1.0
