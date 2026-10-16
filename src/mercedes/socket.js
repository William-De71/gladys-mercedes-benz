// -----------------------------------------------------------------------------
// The push websocket of the Mercedes me app.
//
// On connection, Mercedes sends the full state of every car, then each change
// as it happens. Every update must be acknowledged with its sequence number.
//
// Mercedes blocks an account (HTTP 429, for every device of the account, often
// until midnight GMT) whose websocket stays open too long in a day (about 16
// hours). Like mbapi2020, the integration therefore runs short sessions:
//   - connect, read the full state and the changes;
//   - close after 30 s without any message, unless an engine runs or a
//     command waits for its answer (a ping every 30 s keeps it then);
//   - connect again after the pause (setting, 1 minute by default).
// A refused connection waits longer and longer (10 s × attempts², up to 30
// minutes); a 429 also signs in again once, like the app does.
// -----------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { KINDS, MercedesError, kindOfStatus } from './errors.js';
import { COMMAND_STATES, acknowledgementOf, decodePush, encodeCommand } from './proto.js';

const IDLE_MS = 30000;
const PING_MS = 30000;
const CONNECT_TIMEOUT_MS = 20000;
const MAX_BACKOFF_MS = 30 * 60 * 1000;
const COMMAND_TIMEOUT_MS = 90000;

/**
 * @description The websocket session.
 * @param {object} options - Options.
 * @param {object} options.auth - createAuth().
 * @param {object} options.appVersion - createAppVersion().
 * @param {string} options.sessionId - The app session id.
 * @param {Function} options.getPauseMs - `() => ms` between two sessions.
 * @param {Function} options.onPush - `(type, message)` for each push message.
 * @param {Function} [options.onState] - `({ state, error })` on each change.
 * @param {Function} [options.keepOpen] - `() => boolean`: an engine runs.
 * @param {Function} [options.createWebSocket] - `(url, options) => ws`, for the tests.
 * @param {object} [options.logger] - A logger.
 * @returns {object} The session.
 */
function createSocket({
  auth,
  appVersion,
  sessionId,
  getPauseMs,
  onPush,
  onState = () => {},
  keepOpen = () => false,
  createWebSocket = (url, options) => new WebSocket(url, options),
  logger = null,
}) {
  let ws = null;
  let running = false;
  let connecting = null;
  let failures = 0;
  let reloggedIn = false;
  let state = 'stopped';
  let lastError = null;
  let reconnectTimer = null;
  let idleTimer = null;
  let pingTimer = null;
  let lastMessageAt = null;
  let sessions = 0;
  const pending = new Map();

  const setState = (next, error = null) => {
    lastError = error;
    if (next !== state || error) {
      state = next;
      try {
        onState({ state, error });
      } catch (err) {
        logger?.warn(`State handler failed: ${err.message}`);
      }
    }
  };

  const clearTimers = () => {
    clearTimeout(idleTimer);
    clearInterval(pingTimer);
    idleTimer = null;
    pingTimer = null;
  };

  /**
   * @description Close after IDLE_MS of silence, unless a reason to stay.
   */
  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (pending.size > 0 || keepOpen()) {
        armIdle();
        return;
      }
      logger?.debug?.('No message for 30 s: closing until the next session');
      close();
    }, IDLE_MS);
    idleTimer.unref?.();
  }

  /**
   * @description Schedule the next session.
   * @param {number} delay - In ms.
   */
  function schedule(delay) {
    clearTimeout(reconnectTimer);
    if (!running) {
      return;
    }
    reconnectTimer = setTimeout(() => {
      connect().catch(() => {});
    }, delay);
    reconnectTimer.unref?.();
  }

  /**
   * @description Close the current connection (the next session is scheduled
   * by the close handler).
   */
  function close() {
    clearTimers();
    if (ws) {
      try {
        ws.close(1000, 'Client shutdown');
      } catch {
        ws.terminate?.();
      }
    }
  }

  /**
   * @description Handle a failed connection: what to tell, how long to wait.
   * @param {MercedesError} error - The error.
   * @returns {Promise<number>} The delay before the next attempt.
   */
  async function onFailure(error) {
    failures += 1;
    let delay = Math.min(MAX_BACKOFF_MS, 10000 * failures * failures);
    if (error.kind === KINDS.BLOCKED) {
      setState('blocked', error);
      if (!reloggedIn) {
        reloggedIn = true;
        logger?.info('Websocket refused (429): signing in again');
        await auth.login().catch((err) => logger?.warn(`Sign-in after 429 failed: ${err.message}`));
      }
      delay = Math.max(delay, 5 * 60 * 1000);
    } else if (error.kind === KINDS.OUTDATED) {
      setState('outdated', error);
      await appVersion.refresh({ force: true });
      delay = Math.max(delay, 10 * 60 * 1000);
    } else if (error.kind === KINDS.AUTH || error.kind === KINDS.TWO_FACTOR) {
      setState('auth', error);
      delay = Math.max(delay, 15 * 60 * 1000);
    } else {
      setState('error', error);
    }
    return delay;
  }

  /**
   * @description Open a session now (no-op when one is open or opening).
   * @returns {Promise<void>} Resolves once open; rejects when refused.
   */
  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (connecting) {
      return connecting;
    }
    clearTimeout(reconnectTimer);
    connecting = (async () => {
      let token;
      try {
        await appVersion.refresh();
        token = await auth.accessToken({ force: failures > 0 && lastError?.kind === KINDS.AUTH });
      } catch (err) {
        const error =
          err instanceof MercedesError
            ? err
            : new MercedesError(err.message, { kind: KINDS.UNREACHABLE });
        schedule(await onFailure(error));
        throw error;
      }
      await new Promise((resolve, reject) => {
        let opened = false;
        const socket = createWebSocket(appVersion.profile.websocket, {
          headers: { ...appVersion.websocketHeaders(sessionId), Authorization: token },
          handshakeTimeout: CONNECT_TIMEOUT_MS,
        });
        ws = socket;
        socket.on('unexpected-response', (_request, response) => {
          const status = response.statusCode;
          reject(
            new MercedesError(`Websocket refused (HTTP ${status})`, {
              kind: kindOfStatus(status),
              status,
            }),
          );
          response.resume?.();
          socket.terminate?.();
        });
        socket.on('open', () => {
          opened = true;
          failures = 0;
          reloggedIn = false;
          sessions += 1;
          setState('connected');
          armIdle();
          pingTimer = setInterval(() => {
            try {
              socket.ping();
            } catch {
              // The close handler takes over.
            }
          }, PING_MS);
          pingTimer.unref?.();
          resolve();
        });
        socket.on('message', (data) => {
          lastMessageAt = Date.now();
          armIdle();
          handle(socket, data);
        });
        socket.on('error', (err) => {
          if (!opened) {
            reject(
              new MercedesError(`Websocket error: ${err.message}`, { kind: KINDS.UNREACHABLE }),
            );
          }
        });
        socket.on('close', () => {
          clearTimers();
          if (ws === socket) {
            ws = null;
          }
          if (!opened) {
            reject(
              new MercedesError('Websocket closed during the handshake', {
                kind: KINDS.UNREACHABLE,
              }),
            );
            return;
          }
          if (running) {
            setState('idle');
            schedule(getPauseMs());
          }
        });
      }).catch(async (error) => {
        schedule(await onFailure(error));
        throw error;
      });
    })().finally(() => {
      connecting = null;
    });
    return connecting;
  }

  /**
   * @description Decode, acknowledge and dispatch a frame.
   * @param {WebSocket} socket - The socket.
   * @param {Buffer} data - The frame.
   */
  function handle(socket, data) {
    let decoded;
    try {
      decoded = decodePush(data);
    } catch (err) {
      logger?.warn(`Undecodable message (${data?.length ?? 0} bytes): ${err.message}`);
      return;
    }
    const { type, message } = decoded;
    if (type === 'apptwin_command_status_updates_by_vin') {
      settleCommands(message);
    }
    try {
      onPush(type, message);
    } catch (err) {
      logger?.error(`Message ${type} not handled: ${err.message}`);
    }
    const ack = acknowledgementOf(type, message);
    if (ack && socket.readyState === WebSocket.OPEN) {
      socket.send(ack);
    }
  }

  /**
   * @description Resolve the commands whose final state arrived.
   * @param {object} message - The status updates.
   */
  function settleCommands(message) {
    const byVin = message.apptwin_command_status_updates_by_vin?.updates_by_vin ?? {};
    for (const update of Object.values(byVin)) {
      for (const status of Object.values(update.updates_by_pid ?? {})) {
        const waiting = pending.get(status.request_id);
        if (!waiting) {
          continue;
        }
        if (status.state === COMMAND_STATES.FINISHED || status.state === COMMAND_STATES.FAILED) {
          pending.delete(status.request_id);
          clearTimeout(waiting.timer);
          const error = status.errors?.[0];
          waiting.resolve({
            ok: status.state === COMMAND_STATES.FINISHED,
            status: status.state === COMMAND_STATES.FINISHED ? 'finished' : 'failed',
            code: error?.code ?? null,
            message: error?.message ?? null,
          });
        }
      }
    }
  }

  /**
   * @description Send a command and wait for the car's answer.
   * @param {string} vin - The VIN.
   * @param {{ field: string, payload: object }} command - From buildCommand.
   * @param {object} [options] - Options.
   * @param {number} [options.timeoutMs] - How long to wait for the answer.
   * @returns {Promise<{ ok: boolean, status: string, code: string|null, message: string|null }>} The answer.
   */
  async function sendCommand(vin, { field, payload }, { timeoutMs = COMMAND_TIMEOUT_MS } = {}) {
    await connect();
    const requestId = randomUUID();
    const answer = new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({ ok: false, status: 'timeout', code: null, message: null });
      }, timeoutMs);
      timer.unref?.();
      pending.set(requestId, { resolve, timer });
    });
    try {
      ws.send(encodeCommand(vin, requestId, field, payload));
    } catch (err) {
      clearTimeout(pending.get(requestId)?.timer);
      pending.delete(requestId);
      throw new MercedesError(`Command not sent: ${err.message}`, { kind: KINDS.UNREACHABLE });
    }
    armIdle();
    return answer;
  }

  return {
    /**
     * @description Start the sessions (the first one opens in the background).
     */
    start() {
      running = true;
      connect().catch(() => {});
    },
    /**
     * @description Stop: close, no next session.
     */
    stop() {
      running = false;
      clearTimeout(reconnectTimer);
      close();
      for (const [id, waiting] of pending) {
        clearTimeout(waiting.timer);
        waiting.resolve({ ok: false, status: 'stopped', code: null, message: null });
        pending.delete(id);
      }
      setState('stopped');
    },
    connect,
    sendCommand,
    status: () => ({ state, error: lastError, lastMessageAt, sessions, failures }),
    isOpen: () => Boolean(ws && ws.readyState === WebSocket.OPEN),
  };
}

export { createSocket, IDLE_MS, COMMAND_TIMEOUT_MS };
