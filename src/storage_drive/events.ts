import {
  getStorageDriveEntity,
  STORAGE_DRIVE_BLOCK_TYPE_ID,
  STORAGE_DRIVE_ENTITY_TYPE_ID,
} from ".";
import { showStorageDriveUi } from "./ui";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== STORAGE_DRIVE_BLOCK_TYPE_ID) return;
  e.block.dimension.spawnEntity(STORAGE_DRIVE_ENTITY_TYPE_ID, {
    x: e.block.x + 0.5,
    y: e.block.y,
    z: e.block.z + 0.5,
  });
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

  void showStorageDriveUi(e.player, e.block);
});
