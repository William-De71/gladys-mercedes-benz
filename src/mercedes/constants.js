// -----------------------------------------------------------------------------
// Endpoints and identity of the Mercedes me app.
//
// The integration talks to the servers of the official Mercedes me mobile app,
// as the mbapi2020 Home Assistant integration does (see NOTICE): the CIAM
// sign-in of id.mercedes-benz.com, the "BFF" REST API and the push websocket,
// per region. Mercedes refuses an app it considers too old (HTTP 418): the
// version headers below must follow the app, and the "Advanced" settings
// let a user override them without waiting for a release.
// -----------------------------------------------------------------------------

const REGIONS = {
  EUROPE: 'europe',
  NORTH_AMERICA: 'north_america',
  ASIA_PACIFIC: 'asia_pacific',
};

const LOGIN_BASE_URL = 'https://id.mercedes-benz.com';
// OAuth client of the Mercedes me app (public client, PKCE).
const LOGIN_CLIENT_ID = '62778dc4-1de3-44f4-af95-115f06a3a008';
const LOGIN_REDIRECT_URI = 'rismycar://login-callback';
const LOGIN_SCOPE = 'email profile ciam-uid phone openid offline_access';
// The login pages expect a phone browser.
const LOGIN_BROWSER_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.6 Mobile/15E148 Safari/604.1';

const OS_NAME = 'ios';
const OS_VERSION = '26.3';
const SDK_VERSION = '4.10.0';
const LOCALE = 'en-GB';
const APP_USER_AGENT = 'Mercedes-Benz/3044 CFNetwork/3860.400.22 Darwin/25.3.0';

// Per region: REST and websocket hosts, app name and default version, and
// the user agents the app sends to each server.
const PROFILES = {
  [REGIONS.EUROPE]: {
    rest: 'https://bff.emea-prod.mobilesdk.mercedes-benz.com',
    websocket: 'wss://websocket.emea-prod.mobilesdk.mercedes-benz.com/v2/ws',
    widget: 'https://widget.emea-prod.mobilesdk.mercedes-benz.com',
    appName: 'mycar-store-ece',
    appVersion: '1.68.0 (3060)',
    storeCountry: 'de',
    oauthUserAgent: () => APP_USER_AGENT,
    websocketUserAgent: () => APP_USER_AGENT,
  },
  [REGIONS.NORTH_AMERICA]: {
    rest: 'https://bff.amap-prod.mobilesdk.mercedes-benz.com',
    websocket: 'wss://websocket.amap-prod.mobilesdk.mercedes-benz.com/v2/ws',
    widget: 'https://widget.amap-prod.mobilesdk.mercedes-benz.com',
    appName: 'mycar-store-us',
    appVersion: '3.67.0',
    storeCountry: 'us',
    locale: 'en-US',
    oauthUserAgent: () => APP_USER_AGENT,
    websocketUserAgent: (version, sdk) =>
      `mycar-store-us v${version}, ${OS_NAME} ${OS_VERSION}, SDK ${sdk}`,
  },
  [REGIONS.ASIA_PACIFIC]: {
    rest: 'https://bff.amap-prod.mobilesdk.mercedes-benz.com',
    websocket: 'wss://websocket.amap-prod.mobilesdk.mercedes-benz.com/v2/ws',
    widget: 'https://widget.amap-prod.mobilesdk.mercedes-benz.com',
    appName: 'mycar-store-ap',
    appVersion: '1.67.0',
    storeCountry: 'au',
    oauthUserAgent: (version, sdk) =>
      `mycar-store-ap ${version}, ${OS_NAME} ${OS_VERSION}, SDK ${sdk}`,
    websocketUserAgent: (version, sdk) =>
      `mycar-store-ap ${version}, ${OS_NAME} ${OS_VERSION}, SDK ${sdk}`,
  },
};

export {
  REGIONS,
  LOGIN_BASE_URL,
  LOGIN_CLIENT_ID,
  LOGIN_REDIRECT_URI,
  LOGIN_SCOPE,
  LOGIN_BROWSER_USER_AGENT,
  OS_NAME,
  OS_VERSION,
  SDK_VERSION,
  LOCALE,
  APP_USER_AGENT,
  PROFILES,
};
