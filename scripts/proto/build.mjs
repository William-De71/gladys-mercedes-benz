// -----------------------------------------------------------------------------
// Build src/mercedes/proto.json, the protobuf schema of the Mercedes me app.
//
//   python3 -I scripts/proto/extract.py <mbapi2020>/custom_components/mbapi2020/proto /tmp/desc
//   node scripts/proto/build.mjs /tmp/desc src/mercedes/proto.json
//
// The descriptors come from the generated Python modules of mbapi2020 (MIT,
// Copyright Rene Nulsch, see NOTICE and src/mercedes/PROTO-LICENSE). The
// gogoproto options file is left out (code generation hints only), the
// Google well-known types come from protobufjs.
//
// Run it with protobufjs 7 (the version of package.json): protobufjs 8 names
// the fields after their `json_name` ("error-code"), not their proto name.
// -----------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor/index.js';

const [dir, output] = process.argv.slice(2);
// Dependencies first.
const ORDER = [
  'protos',
  'vin_events',
  'cluster',
  'user_events',
  'service_activation',
  'acp',
  'eventpush',
  'vehicle_commands',
  'vehicleapi',
  'vehicle_events',
  'client',
];

const files = ORDER.map((name) => {
  const file = descriptor.FileDescriptorProto.decode(
    fs.readFileSync(path.join(dir, `${name}.bin`)),
  );
  file.dependency = (file.dependency ?? []).filter((dependency) => dependency !== 'gogo.proto');
  return file;
});

// fromDescriptor resolves at once, before the well-known types are added.
const resolveAll = protobuf.Root.prototype.resolveAll;
protobuf.Root.prototype.resolveAll = function deferred() {
  return this;
};
const root = protobuf.Root.fromDescriptor(descriptor.FileDescriptorSet.create({ file: files }));
protobuf.Root.prototype.resolveAll = resolveAll;
for (const name of [
  'google/protobuf/wrappers.proto',
  'google/protobuf/timestamp.proto',
  'google/protobuf/struct.proto',
]) {
  root.addJSON(protobuf.common.get(name).nested);
}
root.resolveAll();

const json = root.toJSON();
// Old protobufjs versions leave map fields as repeated `*Entry` messages.
const walk = (namespace) => {
  for (const definition of Object.values(namespace.nested ?? {})) {
    if (definition.fields && definition.nested) {
      for (const field of Object.values(definition.fields)) {
        const entryName = String(field.type).split('.').pop();
        const entry = definition.nested[entryName];
        if (field.rule === 'repeated' && entry?.options?.map_entry) {
          field.keyType = entry.fields.key.type;
          field.type = entry.fields.value.type;
          delete field.rule;
          delete definition.nested[entryName];
        }
      }
    }
    walk(definition);
  }
};
walk(json);
protobuf.Root.fromJSON(json).resolveAll();
fs.writeFileSync(output, `${JSON.stringify(json)}\n`);
console.log(`${output}: ${fs.statSync(output).size} bytes`);
