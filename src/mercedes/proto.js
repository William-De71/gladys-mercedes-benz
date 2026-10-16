// -----------------------------------------------------------------------------
// Protobuf messages of the Mercedes me websocket.
//
// proto.json is the schema of the app, generated from the descriptors of the
// mbapi2020 project (MIT, see NOTICE and PROTO-LICENSE in this folder) by
// scripts/proto/build.mjs. Decoded messages are plain objects: snake_case
// names as in the schema, enums and 64-bit integers as numbers.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import protobuf from 'protobufjs';

const root = protobuf.Root.fromJSON(
  JSON.parse(readFileSync(new URL('./proto.json', import.meta.url), 'utf8')),
);
const PushMessage = root.lookupType('proto.PushMessage');
const ClientMessage = root.lookupType('proto.ClientMessage');
const VEPUpdate = root.lookupType('proto.VEPUpdate');

const TO_OBJECT = { enums: Number, longs: Number, oneofs: true, defaults: false };

// Push message -> the client message that acknowledges it (with its
// sequence number). Unacknowledged updates are sent again by the server.
const ACKS = {
  vepUpdates: 'acknowledge_vep_updates_by_vin',
  vehicle_status_updates: 'acknowledge_vehicle_status_updates',
  apptwin_command_status_updates_by_vin: 'acknowledge_apptwin_command_status_update_by_vin',
  service_status_updates: 'acknowledge_service_status_update',
  user_data_update: 'acknowledge_user_data_update',
  user_picture_update: 'acknowledge_user_picture_update',
  user_pin_update: 'acknowledge_user_pin_update',
  vehicle_updated: 'acknowledge_vehicle_updated',
  preferred_dealer_change: 'acknowledge_preferred_dealer_change',
  data_change_event: 'acknowledge_data_change_event',
};

const COMMAND_STATES = {
  FINISHED: 5,
  FAILED: 6,
};

/**
 * @description Decode a push message.
 * @param {Uint8Array} bytes - The websocket frame.
 * @returns {{ type: string|null, message: object }} Its type (the `msg`
 * oneof) and content.
 */
function decodePush(bytes) {
  const decoded = PushMessage.decode(bytes);
  const message = PushMessage.toObject(decoded, TO_OBJECT);
  return { type: message.msg ?? null, message };
}

/**
 * @description Decode the REST "vehicleattributes" answer.
 * @param {Uint8Array} bytes - The body.
 * @returns {object} The VEPUpdate.
 */
function decodeVepUpdate(bytes) {
  return VEPUpdate.toObject(VEPUpdate.decode(bytes), TO_OBJECT);
}

/**
 * @description Encode a client message.
 * @param {object} content - The ClientMessage fields.
 * @returns {Uint8Array} The bytes.
 */
function encodeClient(content) {
  const error = ClientMessage.verify(content);
  if (error) {
    throw new Error(`Invalid client message: ${error}`);
  }
  return ClientMessage.encode(ClientMessage.fromObject(content)).finish();
}

/**
 * @description The answer a push message expects, if any.
 * @param {string} type - The push message type.
 * @param {object} message - The push message.
 * @returns {Uint8Array|null} The client message to send back.
 */
function acknowledgementOf(type, message) {
  if (type === 'assigned_vehicles') {
    return encodeClient({ acknowledge_assigned_vehicles: {} });
  }
  if (type === 'apptwin_pending_command_request') {
    return encodeClient({ apptwin_pending_commands_response: {} });
  }
  const ack = ACKS[type];
  if (!ack) {
    return null;
  }
  return encodeClient({ [ack]: { sequence_number: message[type]?.sequence_number ?? 0 } });
}

/**
 * @description A command request.
 * @param {string} vin - The VIN.
 * @param {string} requestId - The request id (matched in the status updates).
 * @param {string} command - The CommandRequest oneof field (e.g. doors_lock).
 * @param {object} payload - Its content.
 * @returns {Uint8Array} The bytes.
 */
function encodeCommand(vin, requestId, command, payload) {
  return encodeClient({ commandRequest: { vin, request_id: requestId, [command]: payload } });
}

export {
  root,
  COMMAND_STATES,
  decodePush,
  decodeVepUpdate,
  encodeClient,
  encodeCommand,
  acknowledgementOf,
  PushMessage,
  ClientMessage,
  VEPUpdate,
};
