import { world } from "@minecraft/server";
import { DynamicPropertyLocked } from "./utils/dynamic_property";

export const forceLoadNetworksRule = new DynamicPropertyLocked<true>(
  "fluffyalien_asn:rule_force_load_networks",
  world,
);
