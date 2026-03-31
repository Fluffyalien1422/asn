import { addPackName, createManifests } from "./simple_manifest";

const BP_HEADER_UUID = "b12feea5-4a14-473c-9995-66ae2c0f7e53";
const BP_DATA_UUID = "0ed16116-03ca-496d-b51b-85b0a9af6f7d";
const BP_SCRIPT_UUID = "d6b39452-de71-4e5a-9401-a1c48bc1cda2";

const RP_HEADER_UUID = "113a422d-7436-461b-83dd-22064d63da99";
const RP_RESOURCES_UUID = "2a23f8c9-4d67-4e43-95f2-2a1b8cc11565";

createManifests(
  BP_HEADER_UUID,
  BP_DATA_UUID,
  BP_SCRIPT_UUID,
  RP_HEADER_UUID,
  RP_RESOURCES_UUID,
);

addPackName("Advanced Storage Network (BEC)");
