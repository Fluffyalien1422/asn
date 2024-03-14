import {
  EXPORT_BUS_BLOCK_TYPE_ID,
  EXPORT_BUS_ENTITY_TYPE_ID,
  getExportBusEntity,
} from ".";
import { StorageNetwork } from "../storage_network";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== EXPORT_BUS_BLOCK_TYPE_ID) return;

  e.block.dimension.spawnEntity(EXPORT_BUS_ENTITY_TYPE_ID, {
    x: e.block.x + 0.5,
    y: e.block.y,
    z: e.block.z + 0.5,
  });

  StorageNetwork.updateConnectableNetworks(e.block);
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== EXPORT_BUS_BLOCK_TYPE_ID) return;

  getExportBusEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");

  StorageNetwork.getNetwork(
    e.block,
    e.brokenBlockPermutation.type.id
  )?.updateConnections();
});
