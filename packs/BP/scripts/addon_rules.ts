import { world } from "@minecraft/server";
import { DynamicPropertyLocked } from "./utils/dynamic_property";

export const forceLoadNetworksRule = new DynamicPropertyLocked<false>(
  "fluffyalien_asn:rule_force_load_networks",
  world,
);

export const useEnergyRule = new DynamicPropertyLocked<true>(
  "fluffyalien_asn:rule_use_energy",
  world,
);

export function getUseEnergyRule(): boolean {
  return useEnergyRule.get() ?? false;
}
