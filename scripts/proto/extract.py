"""Extract the serialized FileDescriptorProto of each *_pb2.py of mbapi2020.

Usage: python3 -I scripts/proto/extract.py <mbapi2020>/custom_components/mbapi2020/proto <out-dir>

The generated Python modules of mbapi2020 (MIT, Copyright Rene Nulsch) embed
the protobuf schema of the Mercedes me app as serialized descriptors. This
reads them without importing the modules (no protobuf runtime needed).
"""

import ast
import os
import sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for name in sorted(os.listdir(src)):
    if not name.endswith("_pb2.py"):
        continue
    tree = ast.parse(open(os.path.join(src, name), encoding="utf-8").read())
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and getattr(node.func, "attr", "") == "AddSerializedFile":
            data = node.args[0].value
            with open(os.path.join(out, name[: -len("_pb2.py")] + ".bin"), "wb") as target:
                target.write(data)
            print(name, len(data))
