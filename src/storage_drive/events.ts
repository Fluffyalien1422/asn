import {
  getStorageDriveEntity,
  getStorageDriveSerializedData,
  STORAGE_DRIVE_BLOCK_TYPE_ID,
  STORAGE_DRIVE_ENTITY_TYPE_ID,
} from ".";
import { showStorageDriveUi } from "./ui";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== STORAGE_DRIVE_BLOCK_TYPE_ID) return;
  e.block.dimension.spawnEntity(STORAGE_DRIVE_ENTITY_TYPE_ID, e.block.location);
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
