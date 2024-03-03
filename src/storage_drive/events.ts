import {
  getStorageDriveEntity,
  getStorageDriveSerializedData,
  STORAGE_DATA_DYNAMIC_PROPERTY_ID,
} from ".";
import { serialize } from "../serialize";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import {
  STORAGE_DRIVE_BLOCK_TYPE_ID,
  STORAGE_DRIVE_ENTITY_TYPE_ID,
} from "./actors";
import { showStorageDriveUi } from "./ui";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== STORAGE_DRIVE_BLOCK_TYPE_ID) return;
  const entity = e.block.dimension.spawnEntity(
    STORAGE_DRIVE_ENTITY_TYPE_ID,
    e.block.location
  );

  entity.setDynamicProperty(
    STORAGE_DATA_DYNAMIC_PROPERTY_ID,
    serialize([StorageSystemItemStack.fromItemStack(e.block.getItemStack()!)])
  );
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== STORAGE_DRIVE_BLOCK_TYPE_ID) return;
  getStorageDriveEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");
});

let lastPlayerInteractWithBlockTriggerTick = 0;
$.server.world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== STORAGE_DRIVE_BLOCK_TYPE_ID ||
    lastPlayerInteractWithBlockTriggerTick + 5 > $.server.system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = $.server.system.currentTick;

  console.warn(getStorageDriveSerializedData(e.block));

  void showStorageDriveUi(e.player, e.block);
});
