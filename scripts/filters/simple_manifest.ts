import * as fs from "fs";
import * as path from "path";
import * as simpleManifest from "@/data/simple_manifest.json";
import { TMP_DIR } from "./common";

const BP_HEADER_UUID = "b12feea5-4a14-473c-9995-66ae2c0f7e53";
const BP_DATA_UUID = "0ed16116-03ca-496d-b51b-85b0a9af6f7d";
const BP_SCRIPT_UUID = "d6b39452-de71-4e5a-9401-a1c48bc1cda2";

const RP_HEADER_UUID = "113a422d-7436-461b-83dd-22064d63da99";
const RP_RESOURCES_UUID = "2a23f8c9-4d67-4e43-95f2-2a1b8cc11565";

fs.writeFileSync(
  path.join(TMP_DIR, "BP/manifest.json"),
  JSON.stringify({
    format_version: 2,
    header: {
      name: "pack.name",
      description: "pack.description",
      min_engine_version: simpleManifest.minEngineVersion,
      uuid: BP_HEADER_UUID,
      version: simpleManifest.version,
    },
    modules: [
      {
        type: "data",
        uuid: BP_DATA_UUID,
        version: [1, 0, 0],
      },
      {
        type: "script",
        language: "javascript",
        uuid: BP_SCRIPT_UUID,
        entry: "scripts/__bundle.js",
        version: [1, 0, 0],
      },
    ],
    dependencies: [
      {
        uuid: RP_HEADER_UUID,
        version: simpleManifest.version,
      },
      ...simpleManifest.scriptModules.map((scriptMod) => ({
        module_name: scriptMod.name,
        version: scriptMod.version,
      })),
    ],
  }),
);

fs.writeFileSync(
  path.join(TMP_DIR, "RP/manifest.json"),
  JSON.stringify({
    format_version: 2,
    header: {
      name: "pack.name",
      description: "pack.description",
      pack_scope: "world",
      min_engine_version: simpleManifest.minEngineVersion,
      uuid: RP_HEADER_UUID,
      version: simpleManifest.version,
    },
    modules: [
      {
        type: "resources",
        uuid: RP_RESOURCES_UUID,
        version: [1, 0, 0],
      },
    ],
    dependencies: [
      {
        uuid: BP_HEADER_UUID,
        version: simpleManifest.version,
      },
    ],
  }),
);
