import {
  getStorageInterfaceEntity,
  STORAGE_INTERFACE_BLOCK_TYPE_ID,
  STORAGE_INTERFACE_ENTITY_TYPE_ID,
} from ".";
import { StorageNetwork } from "../storage_network";
import { showEstablishNetworkError, showItemsList } from "./ui";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== STORAGE_INTERFACE_BLOCK_TYPE_ID) return;

  e.block.dimension.spawnEntity(
    STORAGE_INTERFACE_ENTITY_TYPE_ID,
    e.block.location
  );
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== STORAGE_INTERFACE_BLOCK_TYPE_ID)
    return;

  getStorageInterfaceEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");
});

let lastPlayerInteractWithBlockTriggerTick = 0;
$.server.world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== STORAGE_INTERFACE_BLOCK_TYPE_ID ||
    lastPlayerInteractWithBlockTriggerTick + 5 > $.server.system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = $.server.system.currentTick;

  const networkResult = StorageNetwork.getOrEstablishNetwork(e.block);
  if (!networkResult.success) {
    void showEstablishNetworkError(e.player, networkResult.error);
    return;
  }

  const network = networkResult.value;

  void showItemsList(e.player, network.getStoredItemStacks(), 0);
});
