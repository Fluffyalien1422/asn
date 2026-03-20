import { addPackName, createManifests } from "./simple_manifest";

const BP_HEADER_UUID = "2b57e33d-5ed7-4d2d-bc1b-93ca2760f3c9";
const BP_DATA_UUID = "a4b44634-903c-4eb9-8b39-ca8c023da172";
const BP_SCRIPT_UUID = "dd4cf7ba-afb3-4d04-bdaa-03cb5a359916";

const RP_HEADER_UUID = "8c5ac2dd-adcc-4806-be05-8f6405a292d6";
const RP_RESOURCES_UUID = "72e18105-91c9-4323-84ad-81de24326165";

createManifests(
  BP_HEADER_UUID,
  BP_DATA_UUID,
  BP_SCRIPT_UUID,
  RP_HEADER_UUID,
  RP_RESOURCES_UUID,
);

addPackName("Advanced Storage Network (BEC)");
