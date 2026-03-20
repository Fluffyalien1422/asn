import * as fs from "fs";
import * as path from "path";
import * as simpleManifest from "@/packs/data/simple_manifest.json";
import { TMP_DIR } from "./common";

export function createManifests(
  bpHeaderUuid: string,
  bpDataUuid: string,
  bpScriptUuid: string,
  rpHeaderUuid: string,
  rpResourcesUuid: string,
): void {
  fs.writeFileSync(
    path.join(TMP_DIR, "BP/manifest.json"),
    JSON.stringify({
      format_version: 2,
      header: {
        name: "pack.name",
        description: "pack.description",
        min_engine_version: simpleManifest.minEngineVersion,
        uuid: bpHeaderUuid,
        version: simpleManifest.version,
      },
      modules: [
        {
          type: "data",
          uuid: bpDataUuid,
          version: [1, 0, 0],
        },
        {
          type: "script",
          language: "javascript",
          uuid: bpScriptUuid,
          entry: "scripts/__bundle.js",
          version: [1, 0, 0],
        },
      ],
      dependencies: [
        {
          uuid: rpHeaderUuid,
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
        uuid: rpHeaderUuid,
        version: simpleManifest.version,
      },
      modules: [
        {
          type: "resources",
          uuid: rpResourcesUuid,
          version: [1, 0, 0],
        },
      ],
      dependencies: [
        {
          uuid: bpHeaderUuid,
          version: simpleManifest.version,
        },
      ],
      capabilities: ["pbr"],
    }),
  );
}

export function addPackName(name: string): void {
  const key = `pack.name=${name}\n`;
  const bpTextsPath = path.join(TMP_DIR, "BP/texts/en_US.lang");
  const rpTextsPath = path.join(TMP_DIR, "RP/texts/en_US.lang");
  fs.writeFileSync(bpTextsPath, key + fs.readFileSync(bpTextsPath, "utf8"));
  fs.writeFileSync(rpTextsPath, key + fs.readFileSync(rpTextsPath, "utf8"));
}
