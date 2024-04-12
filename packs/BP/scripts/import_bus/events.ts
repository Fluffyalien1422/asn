import { StorageNetwork } from "../storage_network";
import { world } from "@minecraft/server";

world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== "fluffyalien_asn:import_bus") return;

  StorageNetwork.updateConnectableNetworks(e.block);
});

world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== "fluffyalien_asn:import_bus") return;

  StorageNetwork.getNetwork(
    e.block,
    e.brokenBlockPermutation.type.id,
  )?.updateConnections();
});
