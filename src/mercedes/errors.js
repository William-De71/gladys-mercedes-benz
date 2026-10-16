// -----------------------------------------------------------------------------
// Errors of the Mercedes client, by kind: what the user must do differs.
//
//   - `auth`        wrong e-mail or password, refused refresh token;
//   - `twoFactor`   the account asks for a code (2FA): not supported;
//   - `blocked`     too many requests (HTTP 429): Mercedes blocks the account
//                   for a while, often until midnight GMT;
//   - `outdated`    HTTP 418: Mercedes refuses this app version;
//   - `unreachable` network error, timeout, 5xx.
// -----------------------------------------------------------------------------

const KINDS = {
  AUTH: 'auth',
  TWO_FACTOR: 'twoFactor',
  BLOCKED: 'blocked',
  OUTDATED: 'outdated',
  UNREACHABLE: 'unreachable',
};

class MercedesError extends Error {
  /**
   * @param {string} message - The message (never a secret).
   * @param {object} [options] - Options.
   * @param {string} [options.kind] - One of KINDS.
   * @param {number} [options.status] - The HTTP status.
   */
  constructor(message, { kind = KINDS.UNREACHABLE, status = null } = {}) {
    super(message);
    this.name = 'MercedesError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description The kind of error an HTTP status stands for.
 * @param {number} status - The status.
 * @returns {string} The kind.
 * @example
 * kindOfStatus(429); // -> 'blocked'
 */
function kindOfStatus(status) {
  if (status === 401 || status === 403) {
    return KINDS.AUTH;
  }
  if (status === 429) {
    return KINDS.BLOCKED;
  }
  if (status === 418) {
    return KINDS.OUTDATED;
  }
  return KINDS.UNREACHABLE;
}

/**
 * @description Hide a VIN in a text: "W1N…1234".
 * @param {string} text - The text.
 * @returns {string} The text.
 * @example
 * redactVin('car W1NKM5BB6VU000123'); // -> 'car W1N…0123'
 */
function redactVin(text) {
  return String(text ?? '').replace(
    /\b([A-HJ-NPR-Z0-9]{3})[A-HJ-NPR-Z0-9]{10}([A-HJ-NPR-Z0-9]{4})\b/g,
    '$1…$2',
  );
}

export { KINDS, MercedesError, kindOfStatus, redactVin };
