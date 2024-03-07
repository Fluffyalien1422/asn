import {
  getStorageDriveEntity,
  getStorageDriveSerializedData,
  STORAGE_DATA_DYNAMIC_PROPERTY_ID,
  STORAGE_DRIVE_BLOCK_TYPE_ID,
  STORAGE_DRIVE_ENTITY_TYPE_ID,
  STORAGE_DRIVE_PLACER_TYPE_ID,
} from ".";
import { StorageNetwork } from "../storage_network";
import { showStorageDriveUi } from "./ui";

$.server.world.afterEvents.itemUseOn.subscribe((e) => {
  if (e.itemStack.typeId !== STORAGE_DRIVE_PLACER_TYPE_ID) return;

  const entity = e.block.dimension.spawnEntity(STORAGE_DRIVE_ENTITY_TYPE_ID, {
    x: e.block.x + Math.floor(e.faceLocation.x) + 0.5,
    y: e.block.y + Math.floor(e.faceLocation.y),
    z: e.block.z + Math.floor(e.faceLocation.z) + 0.5,
  });

  entity.setDynamicProperty(
    STORAGE_DATA_DYNAMIC_PROPERTY_ID,
    e.itemStack.getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID)
  );
});

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== STORAGE_DRIVE_BLOCK_TYPE_ID) return;

  StorageNetwork.updateConnectableNetworks(e.block);
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== STORAGE_DRIVE_BLOCK_TYPE_ID) return;

  const data = getStorageDriveSerializedData(e.block);
  if (data === false) {
    console.warn(
      `(storage_drive/events.ts:playerBreakBlock) Could not read data from storage drive at (${e.block.x}, ${e.block.y}, ${e.block.z}) in ${e.block.dimension.id}. Items will be lost.`
    );
  }

  const itemStack = new $.server.ItemStack(STORAGE_DRIVE_PLACER_TYPE_ID);
  itemStack.setDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID, data);
  e.block.dimension.spawnItem(itemStack, e.block.location);

  getStorageDriveEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");

  StorageNetwork.getNetwork(e.block)?.updateConnections();
});

let lastPlayerInteractWithBlockTriggerTick = 0;
$.server.world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== STORAGE_DRIVE_BLOCK_TYPE_ID ||
    e.player.isSneaking ||
    lastPlayerInteractWithBlockTriggerTick + 5 > $.server.system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = $.server.system.currentTick;

  void showStorageDriveUi(e.player, e.block);
});
