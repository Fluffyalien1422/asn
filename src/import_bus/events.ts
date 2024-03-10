import { IMPORT_BUS_BLOCK_TYPE_ID } from ".";
import { StorageNetwork } from "../storage_network";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== IMPORT_BUS_BLOCK_TYPE_ID) return;

  StorageNetwork.updateConnectableNetworks(e.block);
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== IMPORT_BUS_BLOCK_TYPE_ID) return;

  StorageNetwork.getNetwork(
    e.block,
    e.brokenBlockPermutation.type.id
  )?.updateConnections();
});
